/**
 * useConversations.hook.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Chat history and session management for Zyron.
 *
 * Owns all state and logic related to:
 *   • Loading / persisting the conversations index (AsyncStorage)
 *   • Loading messages for a specific session (SQLite via db.js)
 *   • Paginating older messages when the user scrolls to the top
 *   • Saving the current session's messages after each turn
 *   • Starting a new chat (resetting session state)
 *   • Deleting a single session
 *
 * Returns:
 *   {
 *     conversations, setConversations,
 *     currentSessionId, setCurrentSessionId,
 *     messages, setMessages,
 *     messageOffset, hasMoreMessages,
 *     chatLoading,
 *     loadConversationsIndex,
 *     selectConversation,
 *     loadOlderMessages,
 *     handleNewChat,
 *     handleDeleteSession,
 *     saveActiveSessionMessages,
 *   }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadMessages,
  getMessageCount,
  replaceSessionMessages,
  deleteSessionMessages,
} from '../database/db.init';

/**
 * useConversations
 *
 * @param {function} showConfirmDialog — from parent scope (confirm before delete)
 * @param {function} showToast         — from useToast
 * @param {React.MutableRefObject} restoringConversationRef — ref to prevent premature scroll
 * @param {React.MutableRefObject} chatShouldStickToBottomRef — ref for scroll-to-bottom
 * @param {function} scrollConversationToEnd — scroll helper
 * @param {React.MutableRefObject} autoFocusedRef — ref to allow re-focus on new chat
 */
export default function useConversations({
  showConfirmDialog,
  showToast,
  restoringConversationRef,
  chatShouldStickToBottomRef,
  scrollConversationToEnd,
  autoFocusedRef,
}) {
  const [conversations, setConversations] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  // Pagination: how many messages are loaded for the current session
  const [messageOffset, setMessageOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  // ── Load conversations index ─────────────────────────────────────────────
  const loadConversationsIndex = async () => {
    try {
      const stored = await AsyncStorage.getItem('zyron_CONVERSATIONS');
      if (stored) {
        setConversations(JSON.parse(stored));
      }
    } catch (err) {
      console.warn('Error loading conversations index:', err);
    }
  };

  // ── Load specific conversation session ───────────────────────────────────
  const selectConversation = async (sessionId) => {
    if (sessionId === currentSessionId && !chatLoading) {
      return;
    }

    restoringConversationRef.current = true;
    chatShouldStickToBottomRef.current = true;
    setCurrentSessionId(sessionId);
    setMessages([]);
    setMessageOffset(0);
    setHasMoreMessages(false);
    setChatLoading(true);

    try {
      const PAGE_SIZE = 30;
      const total = await getMessageCount(sessionId);
      const offset = Math.max(0, total - PAGE_SIZE);
      const msgs = await loadMessages(sessionId, PAGE_SIZE, offset);
      setMessages(msgs);
      setMessageOffset(offset);
      setHasMoreMessages(offset > 0);
      setChatLoading(false);
      restoringConversationRef.current = true;
      scrollConversationToEnd();
    } catch (err) {
      console.warn('Error loading conversation messages:', err);
      setChatLoading(false);
      restoringConversationRef.current = false;
    }
  };

  // ── Load older messages when user scrolls to top (pagination) ────────────
  const loadOlderMessages = async () => {
    if (!hasMoreMessages || !currentSessionId) return;
    const PAGE_SIZE = 30;
    const newOffset = Math.max(0, messageOffset - PAGE_SIZE);
    const olderMsgs = await loadMessages(currentSessionId, PAGE_SIZE, newOffset);
    setMessages((prev) => [...olderMsgs, ...prev]);
    setMessageOffset(newOffset);
    setHasMoreMessages(newOffset > 0);
  };

  // ── Start new empty conversation session ─────────────────────────────────
  const handleNewChat = () => {
    restoringConversationRef.current = false;
    // Allow the auto-focus useEffect to re-fire for the welcome screen that
    // is about to appear — same logic, same delay, same blink-free opacity trick.
    autoFocusedRef.current = false;
    setCurrentSessionId(null);
    setMessages([]);
  };

  // ── Delete specific conversation session ─────────────────────────────────
  const handleDeleteSession = async (sessionId, event) => {
    event.stopPropagation(); // Avoid loading the conversation on click
    showConfirmDialog({
      title: 'Delete conversation',
      message: 'This chat will be removed from your local history.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          // Remove messages from SQLite
          await deleteSessionMessages(sessionId);

          // Remove entry from index list
          const updatedIndex = conversations.filter(c => c.id !== sessionId);
          setConversations(updatedIndex);
          await AsyncStorage.setItem('zyron_CONVERSATIONS', JSON.stringify(updatedIndex));

          // Reset screen if the active session was deleted
          if (currentSessionId === sessionId) {
            setCurrentSessionId(null);
            setMessages([]);
            setMessageOffset(0);
            setHasMoreMessages(false);
          }
          showToast('Conversation Deleted', 'Chat removed from history.', 'success');
        } catch (err) {
          console.warn('Failed to delete session:', err);
          showToast('Delete Failed', 'Could not delete conversation.', 'error');
        }
      }
    });
  };

  // ── Save active conversation messages list to SQLite ─────────────────────
  const saveActiveSessionMessages = async (updatedMessages, textSample = '', sessionIdOverride = null) => {
    let sessionId = sessionIdOverride || currentSessionId;
    let isNew = false;

    if (!sessionId) {
      sessionId = String(Date.now());
      setCurrentSessionId(sessionId);
      isNew = true;
    }

    try {
      // Atomically replace the session's rows — handles regeneration/trimming too
      await replaceSessionMessages(sessionId, updatedMessages);

      if (isNew) {
        // Generate neat title from prompt text
        const rawTitle = textSample.trim();
        const finalTitle = rawTitle.length > 30 ? rawTitle.substring(0, 28) + '...' : rawTitle;
        const newRecord = {
          id: sessionId,
          title: finalTitle,
          timestamp: new Date().toISOString(),
        };

        const updatedIndex = [newRecord, ...conversations];
        setConversations(updatedIndex);
        await AsyncStorage.setItem('zyron_CONVERSATIONS', JSON.stringify(updatedIndex));
      }
    } catch (err) {
      console.warn('Error saving messages:', err);
    }

    return sessionId;
  };

  return {
    conversations,
    setConversations,
    currentSessionId,
    setCurrentSessionId,
    messages,
    setMessages,
    messageOffset,
    setMessageOffset,
    hasMoreMessages,
    setHasMoreMessages,
    chatLoading,
    loadConversationsIndex,
    selectConversation,
    loadOlderMessages,
    handleNewChat,
    handleDeleteSession,
    saveActiveSessionMessages,
  };
}

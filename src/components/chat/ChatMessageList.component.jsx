import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { FlatList, View, Animated, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ChatBubble from './ChatBubble.component.jsx';
import AgentCoordinationTable from '../agent/AgentCoordinationTab.component.jsx';
import s from '../../styles/app.styles';

// ─── Thin custom scrollbar ─────────────────────────────────────────────────
const SCROLLBAR_WIDTH = 5;
const MIN_THUMB_RATIO = 0.12;

function CustomScrollbar({ scrollAnim, contentHeight, viewportHeight }) {
  if (!contentHeight || !viewportHeight || contentHeight <= viewportHeight) return null;

  const thumbRatio = Math.min(Math.max(viewportHeight / contentHeight, MIN_THUMB_RATIO), 0.28);
  const thumbHeight = thumbRatio * viewportHeight;
  const maxScrollOffset = contentHeight - viewportHeight;

  const thumbTop = scrollAnim.interpolate({
    inputRange: [0, maxScrollOffset],
    outputRange: [0, viewportHeight - thumbHeight],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: SCROLLBAR_WIDTH,
        justifyContent: 'flex-start',
        pointerEvents: 'none',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          right: 0,
          width: SCROLLBAR_WIDTH,
          height: thumbHeight,
          borderRadius: SCROLLBAR_WIDTH / 2,
          backgroundColor: 'rgba(123, 47, 255, 0.45)',
          transform: [{ translateY: thumbTop }],
        }}
      />
    </View>
  );
}

// ─── Scroll-to-bottom circular button ──────────────────────────────────────
// Appears only when the user has scrolled up and is NOT actively scrolling.
// Fades in after scroll stops (300 ms debounce), disappears at the bottom.
const BOTTOM_THRESHOLD = 80; // px from bottom = "at bottom"
const SCROLL_STOP_DELAY = 300; // ms after last scroll event to show button

function ScrollToBottomBtn({ visible, onPress, opacity }) {
  return (
    <Animated.View
      style={{
        pointerEvents: visible ? 'box-none' : 'none',
        position: 'absolute',
        bottom: 18,
        alignSelf: 'center',
        opacity,
        // shadow
        shadowColor: '#7B2FFF',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 8,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.82}
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: '#18182A',
          borderWidth: 1,
          borderColor: 'rgba(123, 47, 255, 0.55)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 5v14M5 13l7 7 7-7"
            stroke="#A78BFA"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ChatMessageList({
  listRef,
  messages,
  isTyping,
  simulatedAgents,
  coordinationMode,
  lastTokenUsage,
  onScroll,
  onContentSizeChange,
  onLayout,
  onCoordinationLayout,
  contentBottomPadding,
  onRegenerate,
}) {
  // Gate: never show the scroll-to-bottom button while typing OR during TTS.
  // isSpeakingRef is written by the active ChatBubble via its setSpeaking helper.
  const isSpeakingRef = useRef(false);
  const allowBtn = !isTyping && !isSpeakingRef.current;
  const scrollAnim = useRef(new Animated.Value(0)).current;

  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  // Scroll-to-bottom state
  const scrollYRef = useRef(0);
  const isScrollingRef = useRef(false);
  const scrollStopTimerRef = useRef(null);
  const btnOpacity = useRef(new Animated.Value(0)).current;
  const [btnVisible, setBtnVisible] = useState(false);

  // Show/hide the button based on scroll position + scroll idle
  const updateBtnVisibility = useCallback((scrollY, cHeight, vpHeight) => {
    const maxScroll = cHeight - vpHeight;
    const isAtBottom = maxScroll <= 0 || scrollY >= maxScroll - BOTTOM_THRESHOLD;

    if (isAtBottom || isScrollingRef.current || !allowBtn || isSpeakingRef.current) {
      // hide immediately
      if (btnVisible) {
        Animated.timing(btnOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => setBtnVisible(false));
      }
    } else {
      // show (only when not scrolling — called from scroll-stop timer)
      if (!btnVisible) {
        setBtnVisible(true);
        Animated.timing(btnOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [btnVisible, btnOpacity, allowBtn]);

  const handleScrollBeginDrag = useCallback(() => {}, []);

  const handleScroll = useCallback((event) => {
    const y = event.nativeEvent.contentOffset.y;
    scrollAnim.setValue(y);
    scrollYRef.current = y;

    // Mark as scrolling → hide button (also force-hide if AI is typing)
    isScrollingRef.current = true;
    if (btnVisible || !allowBtn) {
      Animated.timing(btnOpacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start(() => setBtnVisible(false));
    }

    // Debounce: after scroll stops, check if we should show button
    if (scrollStopTimerRef.current) clearTimeout(scrollStopTimerRef.current);
    scrollStopTimerRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      updateBtnVisibility(scrollYRef.current, contentHeight, viewportHeight);
    }, SCROLL_STOP_DELAY);

    if (onScroll) onScroll(event);
  }, [onScroll, scrollAnim, btnVisible, btnOpacity, contentHeight, viewportHeight, updateBtnVisibility]);

  const handleContentSizeChange = useCallback((w, h) => {
    setContentHeight(h);
    // During text generation: always pin to bottom so new tokens are visible
    if (isTyping) {
      listRef?.current?.scrollToEnd({ animated: false });
    }
    if (onContentSizeChange) onContentSizeChange(w, h);
  }, [isTyping, listRef, onContentSizeChange]);

  const handleLayout = useCallback((event) => {
    const h = event.nativeEvent.layout.height;
    setViewportHeight(h);
    if (onLayout) onLayout(event);
  }, [onLayout]);

  // When new messages arrive, or typing starts/stops — re-evaluate button visibility.
  useEffect(() => {
    const maxScroll = contentHeight - viewportHeight;
    const isAtBottom = maxScroll <= 0 || scrollYRef.current >= maxScroll - BOTTOM_THRESHOLD;
    if ((isAtBottom || !allowBtn) && btnVisible) {
      Animated.timing(btnOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => setBtnVisible(false));
    }
  }, [contentHeight, messages, allowBtn]);

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (scrollStopTimerRef.current) clearTimeout(scrollStopTimerRef.current);
  }, []);

  const handleScrollToBottom = useCallback(() => {
    listRef?.current?.scrollToEnd({ animated: true });
  }, [listRef]);

  const handleScrollToBubble = useCallback((item) => {
    listRef?.current?.scrollToItem({ item, animated: true, viewPosition: 0 });
  }, [listRef]);

  const renderItem = useCallback(({ item }) => (
    <ChatBubble
      msg={item}
      onRegenerate={item.sender === 'ai' ? onRegenerate : undefined}
      isSpeakingRef={isSpeakingRef}
      onSpeakStart={handleScrollToBubble}
    />
  ), [onRegenerate, handleScrollToBubble]);

  const keyExtractor = useCallback((item) => item.id, []);

  const ListFooterComponent = useMemo(() => {
    if (!isTyping) return null;
    return (
      <View onLayout={onCoordinationLayout}>
        <AgentCoordinationTable
          agents={simulatedAgents}
          isTyping={isTyping}
          coordinationMode={coordinationMode}
          tokenUsage={lastTokenUsage}
        />
      </View>
    );
  }, [isTyping, simulatedAgents, coordinationMode, lastTokenUsage, onCoordinationLayout]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={s.chatArea}
        contentContainerStyle={[
          s.chatContent,
          contentBottomPadding ? { paddingBottom: contentBottomPadding } : null,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onLayout={handleLayout}
        onContentSizeChange={handleContentSizeChange}
        ListFooterComponent={ListFooterComponent}
        initialNumToRender={10}
        maxToRenderPerBatch={4}
        windowSize={11}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={false}
      />
      <CustomScrollbar
        scrollAnim={scrollAnim}
        contentHeight={contentHeight}
        viewportHeight={viewportHeight}
      />
      <ScrollToBottomBtn
        visible={btnVisible}
        onPress={handleScrollToBottom}
        opacity={btnOpacity}
      />
    </View>
  );
}

export default React.memo(ChatMessageList);

import { getTeamById, DEFAULT_TEAM_ID } from './index';
import { applyTeamToRegistry } from '../registry/agentRegistry';

// Lazy import of unified registry to avoid circular deps at module init time.
// Called only inside initActiveTeam (i.e. never at module load).
const _getUnifiedTeam = (teamId) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getTeamByIdUnified } = require('../workshop/customTeamRegistry');
    return getTeamByIdUnified(teamId);
  } catch {
    return getTeamById(teamId);
  }
};

// _activeTeam starts as Dev Core but is overwritten once storage is loaded.
// Do NOT call applyTeamToRegistry here — that must only happen after the
// persisted team id is read from AsyncStorage (see MainApp.js bootstrap).
// The module-level value is a safe default so getActiveTeam() is never null.
let _activeTeam = getTeamById(DEFAULT_TEAM_ID);

export const initActiveTeam = (teamId = DEFAULT_TEAM_ID) => {
  // Use unified lookup so custom teams (persisted in AsyncStorage) are found.
  const team = _getUnifiedTeam(teamId) || getTeamById(DEFAULT_TEAM_ID);
  _activeTeam = team;
  applyTeamToRegistry(team);  // update registry with this team's directives/lenses/icons
  return team;
};

export const getActiveTeam = () => _activeTeam;

export const setActiveTeamById = (teamId) => initActiveTeam(teamId);

// ── NO module-level bootstrap call ─────────────────────────────────────────
// Previously `initActiveTeam(DEFAULT_TEAM_ID)` was called here at import time,
// which locked the registry to Dev Core before AsyncStorage was read.
// The real bootstrap now happens in MainApp.js:loadActiveTeamFromStorage()
// which calls initActiveTeam(storedTeamId) with the user's saved team.

const SPREADSHEET_ID = '1B4E1650vb7Dc2oTJQPD_m_lcBJ-aKIDRrvhCozPYLms';
const GROUPS_SHEET_NAME = 'Groups';
const AUDIT_SHEET_NAME = 'AuditLog';
const MAX_STATE_LENGTH = 45000;
const KEY_PATTERN = /^[a-f0-9]{64}$/;
const CATEGORY_POINTS = {
  snack: 1,
  drink: 2,
  meal: 3,
  special: 5,
};

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'health');

    if (action === 'health') {
      return jsonOutput_({
        ok: true,
        service: 'otokogi-shared-api',
        schemaVersion: 1,
      });
    }

    if (action !== 'get') {
      return errorOutput_('UNKNOWN_ACTION', '未対応の操作です。');
    }

    const key = validateKey_(e.parameter.key);
    const record = findRecord_(key);

    if (!record || record.deletedAt) {
      return errorOutput_('NOT_FOUND', '共有グループが見つかりません。');
    }

    return jsonOutput_({
      ok: true,
      key: key,
      version: record.version,
      state: record.state,
      updatedAt: record.updatedAt,
    });
  } catch (error) {
    console.error(error);
    return safeErrorOutput_(error);
  }
}

function doPost(e) {
  let lock;

  try {
    const payload = parsePayload_(e);
    const action = String(payload.action || '');

    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      return errorOutput_(
        'BUSY',
        'ほかの更新を処理中です。少し待ってからもう一度お試しください。',
      );
    }

    if (action === 'createSpace') {
      return createSpace_(payload.state);
    }

    const key = validateKey_(payload.key);
    const record = findRecord_(key);
    if (!record || record.deletedAt) {
      return errorOutput_('NOT_FOUND', '共有グループが見つかりません。');
    }

    const nextState = applyMutation_(record.state, action, payload);
    const version = record.version + 1;
    const now = new Date().toISOString();
    const serialized = serializeState_(nextState);

    getGroupsSheet_()
      .getRange(record.row, 2, 1, 4)
      .setValues([[version, serialized, record.createdAt, now]]);
    appendAudit_(key, version, action, serialized, now);

    return jsonOutput_({
      ok: true,
      key: key,
      version: version,
      state: nextState,
      updatedAt: now,
    });
  } catch (error) {
    console.error(error);
    return safeErrorOutput_(error);
  } finally {
    if (lock && lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function createSpace_(rawState) {
  const state = validateState_(rawState);
  const key = createShareKey_();
  const version = 1;
  const now = new Date().toISOString();
  const serialized = serializeState_(state);

  getGroupsSheet_().appendRow([key, version, serialized, now, now, '']);
  appendAudit_(key, version, 'createSpace', serialized, now);

  return jsonOutput_({
    ok: true,
    key: key,
    version: version,
    state: state,
    updatedAt: now,
  });
}

function applyMutation_(currentState, action, payload) {
  const state = validateState_(currentState);

  if (action === 'addGroup') {
    const group = validateGroup_(payload.group);
    if (state.groups.some(function (item) { return item.id === group.id; })) {
      throw apiError_('DUPLICATE_ID', '同じグループがすでに存在します。');
    }
    state.groups.push(group);
    state.activeGroupId = group.id;
    return validateState_(state);
  }

  if (action === 'addMember') {
    const group = requireGroup_(state, payload.groupId);
    const member = validateMember_(payload.member);
    if (group.members.some(function (item) { return item.id === member.id; })) {
      throw apiError_('DUPLICATE_ID', '同じメンバーがすでに存在します。');
    }
    group.members.push(member);
    return validateState_(state);
  }

  if (action === 'deleteGroup') {
    const groupId = requireText_(payload.groupId, 'groupId', 120);
    requireGroup_(state, groupId);
    state.groups = state.groups.filter(function (group) {
      return group.id !== groupId;
    });
    state.matches = state.matches.filter(function (match) {
      return match.groupId !== groupId;
    });
    state.activeGroupId = state.groups.length ? state.groups[0].id : null;
    return validateState_(state);
  }

  if (action === 'createMatch') {
    const match = validateMatch_(payload.match, state);
    if (state.matches.some(function (item) { return item.id === match.id; })) {
      throw apiError_('DUPLICATE_ID', '同じ勝負記録がすでに存在します。');
    }
    state.matches.unshift(match);
    state.activeGroupId = match.groupId;
    return validateState_(state);
  }

  if (action === 'deleteMatch') {
    const matchId = requireText_(payload.matchId, 'matchId', 120);
    if (!state.matches.some(function (match) { return match.id === matchId; })) {
      throw apiError_('NOT_FOUND', '削除する勝負記録が見つかりません。');
    }
    state.matches = state.matches.filter(function (match) {
      return match.id !== matchId;
    });
    return validateState_(state);
  }

  throw apiError_('UNKNOWN_ACTION', '未対応の操作です。');
}

function validateState_(rawState) {
  if (!rawState || typeof rawState !== 'object') {
    throw apiError_('INVALID_STATE', 'グループデータの形式が正しくありません。');
  }

  const rawGroups = Array.isArray(rawState.groups) ? rawState.groups : [];
  const rawMatches = Array.isArray(rawState.matches) ? rawState.matches : [];

  if (rawGroups.length > 20 || rawMatches.length > 2000) {
    throw apiError_('LIMIT_EXCEEDED', '登録できるデータ件数を超えています。');
  }

  const groups = rawGroups.map(validateGroup_);
  const groupIds = {};
  groups.forEach(function (group) {
    if (groupIds[group.id]) {
      throw apiError_('DUPLICATE_ID', 'グループIDが重複しています。');
    }
    groupIds[group.id] = true;
  });

  const state = {
    groups: groups,
    matches: [],
    activeGroupId: null,
  };

  state.matches = rawMatches.map(function (match) {
    return validateMatch_(match, state);
  });

  const requestedActiveId =
    typeof rawState.activeGroupId === 'string' ? rawState.activeGroupId : null;
  state.activeGroupId = groups.some(function (group) {
    return group.id === requestedActiveId;
  })
    ? requestedActiveId
    : groups.length
      ? groups[0].id
      : null;

  return state;
}

function validateGroup_(rawGroup) {
  if (!rawGroup || typeof rawGroup !== 'object') {
    throw apiError_('INVALID_GROUP', 'グループ情報が正しくありません。');
  }

  const rawMembers = Array.isArray(rawGroup.members) ? rawGroup.members : [];
  if (rawMembers.length > 100) {
    throw apiError_('LIMIT_EXCEEDED', '1グループのメンバー上限は100人です。');
  }

  const members = rawMembers.map(validateMember_);
  const memberIds = {};
  members.forEach(function (member) {
    if (memberIds[member.id]) {
      throw apiError_('DUPLICATE_ID', 'メンバーIDが重複しています。');
    }
    memberIds[member.id] = true;
  });

  return {
    id: requireText_(rawGroup.id, 'group.id', 120),
    name: requireText_(rawGroup.name, 'group.name', 30),
    emoji: optionalText_(rawGroup.emoji, 8) || '✊',
    description: optionalText_(rawGroup.description, 80),
    members: members,
    createdAt: requireIsoDate_(rawGroup.createdAt, 'group.createdAt'),
  };
}

function validateMember_(rawMember) {
  if (!rawMember || typeof rawMember !== 'object') {
    throw apiError_('INVALID_MEMBER', 'メンバー情報が正しくありません。');
  }

  return {
    id: requireText_(rawMember.id, 'member.id', 120),
    name: requireText_(rawMember.name, 'member.name', 20),
    color: /^#[0-9a-fA-F]{6}$/.test(String(rawMember.color || ''))
      ? String(rawMember.color)
      : '#57508B',
    createdAt: requireIsoDate_(rawMember.createdAt, 'member.createdAt'),
  };
}

function validateMatch_(rawMatch, state) {
  if (!rawMatch || typeof rawMatch !== 'object') {
    throw apiError_('INVALID_MATCH', '勝負記録が正しくありません。');
  }

  const groupId = requireText_(rawMatch.groupId, 'match.groupId', 120);
  const group = requireGroup_(state, groupId);
  const participantIds = Array.isArray(rawMatch.participantIds)
    ? rawMatch.participantIds.map(function (id) {
        return requireText_(id, 'participantId', 120);
      })
    : [];
  const memberIds = {};
  group.members.forEach(function (member) {
    memberIds[member.id] = true;
  });

  if (participantIds.length < 2) {
    throw apiError_('INVALID_MATCH', '参加者は2人以上必要です。');
  }
  participantIds.forEach(function (id) {
    if (!memberIds[id]) {
      throw apiError_('INVALID_MATCH', 'グループ外の参加者が含まれています。');
    }
  });

  const otokogiId = requireText_(rawMatch.otokogiId, 'match.otokogiId', 120);
  if (!memberIds[otokogiId] || participantIds.indexOf(otokogiId) === -1) {
    throw apiError_('INVALID_MATCH', '男気を見せた人の指定が正しくありません。');
  }

  const category = String(rawMatch.category || '');
  if (!Object.prototype.hasOwnProperty.call(CATEGORY_POINTS, category)) {
    throw apiError_('INVALID_MATCH', '勝負カテゴリが正しくありません。');
  }

  const playedAt = requireText_(rawMatch.playedAt, 'match.playedAt', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(playedAt)) {
    throw apiError_('INVALID_MATCH', '勝負日の形式が正しくありません。');
  }

  return {
    id: requireText_(rawMatch.id, 'match.id', 120),
    groupId: groupId,
    playedAt: playedAt,
    stake: requireText_(rawMatch.stake, 'match.stake', 80),
    category: category,
    otokogiId: otokogiId,
    participantIds: participantIds.filter(function (id, index, values) {
      return values.indexOf(id) === index;
    }),
    points: CATEGORY_POINTS[category],
    memo: optionalText_(rawMatch.memo, 200),
    createdAt: requireIsoDate_(rawMatch.createdAt, 'match.createdAt'),
  };
}

function findRecord_(key) {
  const sheet = getGroupsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0]) !== key) continue;

    return {
      row: index + 2,
      key: key,
      version: Number(values[index][1]) || 1,
      state: JSON.parse(String(values[index][2] || '{}')),
      createdAt: asIsoString_(values[index][3]),
      updatedAt: asIsoString_(values[index][4]),
      deletedAt: values[index][5] ? asIsoString_(values[index][5]) : '',
    };
  }

  return null;
}

function getGroupsSheet_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(
    GROUPS_SHEET_NAME,
  );
  if (!sheet) {
    throw apiError_('SETUP_REQUIRED', 'Groupsシートが見つかりません。');
  }
  return sheet;
}

function appendAudit_(key, version, action, snapshot, recordedAt) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(
    AUDIT_SHEET_NAME,
  );
  if (!sheet) {
    throw apiError_('SETUP_REQUIRED', 'AuditLogシートが見つかりません。');
  }

  sheet.appendRow([
    Utilities.getUuid(),
    key,
    version,
    action,
    snapshot,
    recordedAt,
  ]);
}

function parsePayload_(e) {
  const raw = e && e.postData ? String(e.postData.contents || '') : '';
  if (!raw) {
    throw apiError_('INVALID_REQUEST', '送信データがありません。');
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw apiError_('INVALID_JSON', '送信データを読み取れませんでした。');
  }
}

function serializeState_(state) {
  const serialized = JSON.stringify(validateState_(state));
  if (serialized.length > MAX_STATE_LENGTH) {
    throw apiError_(
      'STATE_TOO_LARGE',
      '記録量が上限に達しました。管理者にお問い合わせください。',
    );
  }
  return serialized;
}

function validateKey_(value) {
  const key = String(value || '').toLowerCase();
  if (!KEY_PATTERN.test(key)) {
    throw apiError_('INVALID_KEY', '共有URLが正しくありません。');
  }
  return key;
}

function createShareKey_() {
  return (Utilities.getUuid() + Utilities.getUuid())
    .replace(/-/g, '')
    .toLowerCase();
}

function requireGroup_(state, groupId) {
  const id = requireText_(groupId, 'groupId', 120);
  const group = state.groups.find(function (item) {
    return item.id === id;
  });
  if (!group) {
    throw apiError_('NOT_FOUND', 'グループが見つかりません。');
  }
  return group;
}

function requireText_(value, field, maxLength) {
  const text = String(value == null ? '' : value).trim();
  if (!text || text.length > maxLength) {
    throw apiError_('INVALID_FIELD', field + 'の値が正しくありません。');
  }
  return text;
}

function optionalText_(value, maxLength) {
  const text = String(value == null ? '' : value).trim();
  if (text.length > maxLength) {
    throw apiError_('INVALID_FIELD', '入力文字数が上限を超えています。');
  }
  return text;
}

function requireIsoDate_(value, field) {
  const text = requireText_(value, field, 40);
  if (Number.isNaN(Date.parse(text))) {
    throw apiError_('INVALID_FIELD', field + 'の日時が正しくありません。');
  }
  return text;
}

function asIsoString_(value) {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value || '') : parsed.toISOString();
}

function apiError_(code, message) {
  const error = new Error(message);
  error.apiCode = code;
  return error;
}

function safeErrorOutput_(error) {
  return errorOutput_(
    error && error.apiCode ? error.apiCode : 'SERVER_ERROR',
    error && error.apiCode
      ? error.message
      : 'サーバーでエラーが発生しました。時間を置いて再度お試しください。',
  );
}

function errorOutput_(code, message) {
  return jsonOutput_({
    ok: false,
    code: code,
    message: message,
  });
}

function jsonOutput_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

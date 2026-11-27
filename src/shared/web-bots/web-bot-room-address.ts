export const WEB_BOT_ROOM_MEMBER_PREFIX = 'web_bot:'

export type ParsedWebBotRoomMember = {
  providerId: string
  uuid: string
}

export function formatWebBotRoomMemberId(providerId: string, uuid: string): string {
  return `${WEB_BOT_ROOM_MEMBER_PREFIX}${providerId}:${uuid}`
}

export function parseWebBotRoomMemberId(
  memberId: string | null | undefined
): ParsedWebBotRoomMember | null {
  if (!memberId || !memberId.startsWith(WEB_BOT_ROOM_MEMBER_PREFIX)) {
    return null
  }
  const rest = memberId.slice(WEB_BOT_ROOM_MEMBER_PREFIX.length)
  const colonIdx = rest.indexOf(':')
  if (colonIdx <= 0) {
    return null
  }
  const providerId = rest.slice(0, colonIdx).trim()
  const uuid = rest.slice(colonIdx + 1).trim()
  if (!providerId || !uuid) {
    return null
  }
  return { providerId, uuid }
}

export function isWebBotRoomMemberId(memberId: string | null | undefined): boolean {
  return parseWebBotRoomMemberId(memberId) !== null
}

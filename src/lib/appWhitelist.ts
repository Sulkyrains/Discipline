import type { WhitelistApp } from '../types'

// The whitelist starts empty: users pick apps from their own installed app
// list (native picker). No preset app lists.
export function defaultWhitelist(): WhitelistApp[] {
  return []
}

export function whitelistPackages(list: WhitelistApp[]): string[] {
  return list.map((a) => a.id)
}

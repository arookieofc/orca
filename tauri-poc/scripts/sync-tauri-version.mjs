import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = typeof pkg.version === 'string' && pkg.version.trim() ? pkg.version.trim() : null
if (!version) {
  throw new Error('Root package.json is missing a valid version string.')
}

const tauriConfPath = join(root, 'tauri-poc', 'src-tauri', 'tauri.conf.json')
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'))
if (tauriConf.version !== version) {
  tauriConf.version = version
  writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`, 'utf8')
}

const cargoTomlPath = join(root, 'tauri-poc', 'src-tauri', 'Cargo.toml')
const cargoRaw = readFileSync(cargoTomlPath, 'utf8')
const nextCargo = cargoRaw.replace(/^(version\s*=\s*)"[^"]*"/m, `$1"${version}"`)
if (nextCargo !== cargoRaw) {
  writeFileSync(cargoTomlPath, nextCargo, 'utf8')
}

console.log(`Synchronized Tauri version to ${version}`)

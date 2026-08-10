#!/usr/bin/env node
/**
 * One-command Android APK build for the combined website + APK release.
 *
 * Prereqs: `npm run build:gh-pages` has produced dist/, JDK 17 + Android SDK
 * are installed, and the release keystore exists.
 *
 * Usage:
 *   node scripts/build-apk.mjs            # version read from package.json
 *   node scripts/build-apk.mjs 2.2.3      # explicit version
 *
 * Env overrides:
 *   DISCIPLINE_JAVA_HOME      (default C:\Users\28683\.discipline-build\jdk-17.0.20+8)
 *   DISCIPLINE_ANDROID_SDK    (default %LOCALAPPDATA%\Android\Sdk)
 *   DISCIPLINE_MIRROR_INIT    (default C:\Users\28683\.discipline-build\mirror.init.gradle)
 *   DISCIPLINE_KEYSTORE_INFO  (default C:\Users\28683\.discipline-build\keystore-info.txt)
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const version = process.argv[2] ?? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
const javaHome =
  process.env.DISCIPLINE_JAVA_HOME ?? 'C:\\Users\\28683\\.discipline-build\\jdk-17.0.20+8'
const sdk = process.env.DISCIPLINE_ANDROID_SDK ?? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk')
const mirrorInit =
  process.env.DISCIPLINE_MIRROR_INIT ?? 'C:\\Users\\28683\\.discipline-build\\mirror.init.gradle'
const ksInfoFile =
  process.env.DISCIPLINE_KEYSTORE_INFO ?? 'C:\\Users\\28683\\.discipline-build\\keystore-info.txt'

function run(cmd, args, opts = {}) {
  console.log(`> ${cmd} ${args.join(' ')}`)
  execFileSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts
  })
}

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: sdk,
  ANDROID_SDK_ROOT: sdk
}

// 1. Sync web assets into the Capacitor project.
const cap = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'cap.cmd' : 'cap')
run(cap, ['sync', 'android'], { cwd: root, env })

// 2. Gradle release build.
const gradlew = join(root, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
run(gradlew, ['--no-daemon', '-I', mirrorInit, 'assembleRelease'], {
  cwd: join(root, 'android'),
  env
})

// 3. Read keystore credentials.
const ksInfo = readFileSync(ksInfoFile, 'utf8').replace(/^\uFEFF/, '')
const keystore = (ksInfo.match(/^keystore=(.+)$/m) ?? [])[1]
const pass = (ksInfo.match(/^storepass=(.+)$/m) ?? [])[1]
if (!keystore || !pass || !existsSync(keystore)) {
  throw new Error(`keystore info missing at ${ksInfoFile}`)
}

// 4. Align and sign.
const bt = join(sdk, 'build-tools', '34.0.0')
const unsigned = join(
  root,
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release-unsigned.apk'
)
const aligned = join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-aligned.apk')
const out = join(root, 'dist', 'apk', `Discipline-v${version}.apk`)
mkdirSync(join(root, 'dist', 'apk'), { recursive: true })
run(join(bt, 'zipalign'), ['-f', '-p', '4', unsigned, aligned], { env })
run(
  join(bt, process.platform === 'win32' ? 'apksigner.bat' : 'apksigner'),
  ['sign', '--ks', keystore, '--ks-pass', `pass:${pass}`, '--key-pass', `pass:${pass}`, '--out', out, aligned],
  { env }
)
run(join(bt, process.platform === 'win32' ? 'apksigner.bat' : 'apksigner'), ['verify', '--print-certs', out], { env })
console.log(`APK ready: ${out}`)

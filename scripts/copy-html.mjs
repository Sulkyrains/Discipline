import { copyFileSync } from 'node:fs'

copyFileSync('dist-html/index.html', 'discipline.html')
console.log('single-file html written: discipline.html')

import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { format } from 'prettier'
import './index'

async function main() {
  const result = await format(
    readFileSync(path.resolve(__dirname, 'runtime-core.d.ts'), 'utf-8'),
    {
      parser: 'typescript',
    },
  )

  writeFileSync(path.resolve(__dirname, 'runtime-core.d.ts'), result)
}

main()

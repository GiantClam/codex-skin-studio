import assert from 'node:assert/strict'
import test from 'node:test'

import { mapPayloadSkin } from '../src/lib/skins/catalog.ts'

const baseSkin = {
  slug: 'neon-companion',
  title: 'Neon Companion',
  summary: 'A paired desktop theme and Pet.',
  version: '1.0.0',
  targets: ['codex', 'chatgpt'],
  categories: ['anime-2d'],
  palette: ['cyan'],
  status: 'published',
}

test('maps paired Payload metadata into the public catalog contract', () => {
  const skin = mapPayloadSkin({
    ...baseSkin,
    packageKind: 'paired',
    petId: 'neon-companion',
    petDisplayName: 'Neon Companion Pet',
    petContractVersion: 'codex-v2-hatch-pet',
  })

  assert.equal(skin.packageKind, 'paired')
  assert.equal(skin.hasPet, true)
  assert.deepEqual(skin.pet, {
    id: 'neon-companion',
    displayName: 'Neon Companion Pet',
    contractVersion: 'codex-v2-hatch-pet',
  })
})

test('keeps legacy Payload records compatible as theme-only packages', () => {
  const skin = mapPayloadSkin(baseSkin)
  assert.equal(skin.packageKind, 'theme')
  assert.equal(skin.hasPet, false)
  assert.equal(skin.pet, null)
})

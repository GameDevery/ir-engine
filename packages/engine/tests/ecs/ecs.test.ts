/*
CPAL-1.0 License

The contents of this file are subject to the Common Public Attribution License
Version 1.0. (the "License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at
https://github.com/EtherealEngine/etherealengine/blob/dev/LICENSE.
The License is based on the Mozilla Public License Version 1.1, but Sections 14
and 15 have been added to cover use of software over a computer network and 
provide for limited attribution for the Original Developer. In addition, 
Exhibit A has been modified to be consistent with Exhibit B.

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the
specific language governing rights and limitations under the License.

The Original Code is Ethereal Engine.

The Original Developer is the Initial Developer. The Initial Developer of the
Original Code is the Ethereal Engine team.

All portions of the code written by the Ethereal Engine team are Copyright © 2021-2023 
Ethereal Engine. All Rights Reserved.
*/

import assert from 'assert'

import { getState } from '@etherealengine/hyperflux'
import { destroyEngine, Engine } from '../../src/ecs/classes/Engine'
import { Entity } from '../../src/ecs/classes/Entity'
import { SceneState } from '../../src/ecs/classes/Scene'
import {
  defineComponent,
  getComponent,
  getOptionalComponent,
  hasComponent,
  removeComponent,
  setComponent
} from '../../src/ecs/functions/ComponentFunctions'
import { executeSystems } from '../../src/ecs/functions/EngineFunctions'
import { createEntity, removeEntity } from '../../src/ecs/functions/EntityFunctions'
import { defineQuery } from '../../src/ecs/functions/QueryFunctions'
import { defineSystem } from '../../src/ecs/functions/SystemFunctions'
import { AnimationSystemGroup } from '../../src/ecs/functions/SystemGroups'
import { createEngine } from '../../src/initializeEngine'
import { loadEmptyScene } from '../util/loadEmptyScene'

const mockDeltaMillis = 1000 / 60

const MockComponent = defineComponent({
  name: 'MockComponent',
  onInit: (entity) => {
    return {
      mockValue: 0
    }
  },
  onSet: (entity, component, json: { mockValue: number }) => {
    if (typeof json?.mockValue === 'number') component.mockValue.set(json.mockValue)
  },
  toJSON: (entity, component) => {
    return {
      mockValue: component.mockValue.value
    }
  }
})

const MockSystemState = new Map<Entity, Array<number>>()

const mockQuery = defineQuery([MockComponent])

const execute = () => {
  const mockState = MockSystemState.get(SceneState.getRootEntity(getState(SceneState).activeScene!))!

  for (const entity of mockQuery.enter()) {
    mockState.push(entity)
  }

  for (const entity of mockQuery.exit()) {
    mockState.splice(mockState.indexOf(entity))
  }
}

const MockSystem = defineSystem({
  uuid: 'MockSystem',
  insert: { with: AnimationSystemGroup },
  execute
})

describe('ECS', () => {
  beforeEach(async () => {
    createEngine()
    loadEmptyScene()
    MockSystemState.set(SceneState.getRootEntity(getState(SceneState).activeScene!), [])
  })

  afterEach(() => {
    return destroyEngine()
  })

  it('should create ECS world', () => {
    const entities = Engine.instance.entityQuery()
    assert(entities.includes(SceneState.getRootEntity(getState(SceneState).activeScene!)))
    assert(entities.includes(Engine.instance.cameraEntity))
  })

  it('should add entity', async () => {
    const entityLengthBeforeCreate = Engine.instance.entityQuery().length
    const entity = createEntity()
    const entitiesAfterCreate = Engine.instance.entityQuery()
    assert(entitiesAfterCreate.includes(SceneState.getRootEntity(getState(SceneState).activeScene!)))
    assert(entitiesAfterCreate.includes(entity))
    assert.strictEqual(entitiesAfterCreate.length, entityLengthBeforeCreate + 1)
  })

  it('should support enter and exit queries', () => {
    const entity = createEntity()
    const query = defineQuery([MockComponent])

    assert.equal(query().length, 0)
    assert.equal(query.enter().length, 0)
    assert.equal(query.exit().length, 0)

    setComponent(entity, MockComponent, { mockValue: 42 })
    assert.ok(query().includes(entity))
    assert.equal(query.enter()[0], entity)
    assert.equal(query.exit().length, 0)

    removeComponent(entity, MockComponent)
    assert.ok(!query().includes(entity))
    assert.equal(query.enter().length, 0)
    assert.equal(query.exit()[0], entity)

    setComponent(entity, MockComponent, { mockValue: 43 })
    assert.ok(query().includes(entity))
    assert.equal(query.enter()[0], entity)
    assert.equal(query.exit().length, 0)

    removeComponent(entity, MockComponent)
    setComponent(entity, MockComponent, { mockValue: 44 })
    assert.ok(query().includes(entity))
    let enter = query.enter()
    let exit = query.exit()
    assert.equal(enter.length, 1)
    assert.equal(enter[0], entity)

    /** @todo - revisit this with new bitecs release, enterQUery vs enterQueue */
    // assert.equal(exit.length, 0)
    // assert.equal(exit.length, 1)
    // assert.equal(exit[0], entity)

    removeComponent(entity, MockComponent)
    // @ts-expect-error - should have type error for wrong unknown property
    setComponent(entity, MockComponent, { mockValueWrong: 44 })

    removeComponent(entity, MockComponent)
    // @ts-expect-error - should have type error for wrong missing required property
    setComponent(entity, MockComponent, {})

    removeComponent(entity, MockComponent)
    // @ts-expect-error - should have type error for wrong value type
    setComponent(entity, MockComponent, { mockValue: 'hi' })
  })

  it('should add component', async () => {
    const entity = createEntity()
    const mockValue = Math.random()
    setComponent(entity, MockComponent, { mockValue })
    const component = getComponent(entity, MockComponent)
    assert(component)
    assert.strictEqual(component.mockValue, mockValue)
  })

  it('should query component in systems', async () => {
    const entity = createEntity()
    const mockValue = Math.random()
    setComponent(entity, MockComponent, { mockValue })
    const component = getComponent(entity, MockComponent)
    executeSystems(mockDeltaMillis)
    assert.strictEqual(entity, MockSystemState.get(SceneState.getRootEntity(getState(SceneState).activeScene!))![0])

    const entity2 = createEntity()
    const mockValue2 = Math.random()
    setComponent(entity2, MockComponent, { mockValue: mockValue2 })
    const component2 = getComponent(entity2, MockComponent)
    executeSystems(mockDeltaMillis * 2)
    assert.strictEqual(entity2, MockSystemState.get(SceneState.getRootEntity(getState(SceneState).activeScene!))![1])
  })

  it('should remove and clean up component', async () => {
    const entity = createEntity()
    const mockValue = Math.random()

    setComponent(entity, MockComponent, { mockValue })
    removeComponent(entity, MockComponent)

    const query = defineQuery([MockComponent])
    assert.deepStrictEqual([...query()], [])
    assert.deepStrictEqual(query.enter(), [])
    assert.deepStrictEqual(query.exit(), [])

    executeSystems(mockDeltaMillis)
    assert.deepStrictEqual(MockSystemState.get(SceneState.getRootEntity(getState(SceneState).activeScene!))!, [])
  })

  it('should re-add component', async () => {
    const entity = createEntity()
    const state = MockSystemState.get(SceneState.getRootEntity(getState(SceneState).activeScene!))!

    const mockValue = Math.random()
    setComponent(entity, MockComponent, { mockValue })

    removeComponent(entity, MockComponent)
    executeSystems(mockDeltaMillis)
    assert.deepStrictEqual(state, [])

    const newMockValue = 1 + Math.random()
    assert.equal(hasComponent(entity, MockComponent), false)
    setComponent(entity, MockComponent, { mockValue: newMockValue })
    assert.equal(hasComponent(entity, MockComponent), true)
    const component = getComponent(entity, MockComponent)
    assert(component)
    assert.strictEqual(component.mockValue, newMockValue)
    executeSystems(mockDeltaMillis * 2)
    executeSystems(mockDeltaMillis * 3)
    assert.strictEqual(entity, state[0])
  })

  it('should remove and clean up entity', async () => {
    const entity = createEntity()
    const mockValue = Math.random()
    setComponent(entity, MockComponent, { mockValue })
    const entities = Engine.instance.entityQuery()
    assert(entities.includes(entity))
    removeEntity(entity)
    assert.ok(!getOptionalComponent(entity, MockComponent))
    executeSystems(mockDeltaMillis)
    assert.deepStrictEqual(MockSystemState.get(SceneState.getRootEntity(getState(SceneState).activeScene!))!, [])
    assert.ok(!Engine.instance.entityQuery().includes(entity))
  })

  it('should remove entity', async () => {
    const entity = createEntity()

    const lengthBefore = Engine.instance.entityQuery().length
    removeEntity(entity)
    const entities = Engine.instance.entityQuery()
    assert.equal(entities.length, lengthBefore - 1)
  })

  it('should noop with entity that is already removed', async () => {
    const entity = createEntity()

    const lengthBefore = Engine.instance.entityQuery().length

    removeEntity(entity)
    removeEntity(entity)

    const entities = Engine.instance.entityQuery()
    assert.equal(entities.length, lengthBefore - 1)
  })
})

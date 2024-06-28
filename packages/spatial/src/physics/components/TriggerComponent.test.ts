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

import { World } from '@dimforge/rapier3d-compat'
import {
  EntityUUID,
  UndefinedEntity,
  createEngine,
  createEntity,
  destroyEngine,
  getComponent,
  removeComponent,
  removeEntity,
  serializeComponent,
  setComponent
} from '@etherealengine/ecs'
import { getMutableState } from '@etherealengine/hyperflux'
import assert from 'assert'
import { Vector3 } from 'three'
import { TransformComponent } from '../../SpatialModule'
import { Physics } from '../classes/Physics'
import { CollisionGroups, DefaultCollisionMask } from '../enums/CollisionGroups'
import { PhysicsState } from '../state/PhysicsState'
import { Shapes } from '../types/PhysicsTypes'
import { ColliderComponent } from './ColliderComponent'
import { ColliderComponentDefaults, assertColliderComponentEquals } from './ColliderComponent.test'
import { RigidBodyComponent } from './RigidBodyComponent'
import { TriggerComponent } from './TriggerComponent'

const TriggerComponentDefaults = {
  triggers: [] as Array<{
    onEnter: null | string
    onExit: null | string
    target: null | EntityUUID
  }>
}

function assertArrayEqual<T>(A: Array<T>, B: Array<T>, err = 'Arrays are not equal') {
  assert.equal(A.length, B.length, err)
  for (let id = 0; id < A.length && id < B.length; id++) {
    assert.deepEqual(A[id], B[id], err)
  }
}

function assertArrayNotEqual<T>(A: Array<T>, B: Array<T>, err = 'Arrays are equal') {
  for (let id = 0; id < A.length && id < B.length; id++) {
    assert.notDeepEqual(A[id], B[id], err)
  }
}

function assertTriggerComponentEqual(data, expected) {
  assertArrayEqual(data.triggers, expected.triggers)
}

function assertTriggerComponentNotEqual(data, expected) {
  assertArrayNotEqual(data.triggers, expected.triggers)
}

describe('TriggerComponent', () => {
  describe('IDs', () => {
    it('should initialize the TriggerComponent.name field with the expected value', () => {
      assert.equal(TriggerComponent.name, 'TriggerComponent')
    })
    it('should initialize the TriggerComponent.jsonID field with the expected value', () => {
      assert.equal(TriggerComponent.jsonID, 'EE_trigger')
    })
  })

  describe('onInit', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
      setComponent(testEntity, TriggerComponent)
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should initialize the component with the expected default values', () => {
      const data = getComponent(testEntity, TriggerComponent)
      assertTriggerComponentEqual(data, TriggerComponentDefaults)
    })
  }) // << onInit

  describe('onSet', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
      setComponent(testEntity, TriggerComponent)
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should change the values of an initialized TriggerComponent', () => {
      const Expected = {
        triggers: [
          {
            onEnter: 'onEnter.Expected',
            onExit: 'onExit.Expected',
            target: 'target' as EntityUUID
          }
        ]
      }
      const before = getComponent(testEntity, TriggerComponent)
      assertTriggerComponentEqual(before, TriggerComponentDefaults)
      setComponent(testEntity, TriggerComponent, Expected)

      const data = getComponent(testEntity, TriggerComponent)
      assertTriggerComponentEqual(data, Expected)
    })

    it('should not change values of an initialized TriggerComponent when the data passed had incorrect types', () => {
      const Incorrect = { triggers: 'triggers' }
      const before = getComponent(testEntity, TriggerComponent)
      assertTriggerComponentEqual(before, TriggerComponentDefaults)

      // @ts-ignore
      setComponent(testEntity, TriggerComponent, Incorrect)
      const data = getComponent(testEntity, TriggerComponent)
      assertTriggerComponentEqual(data, TriggerComponentDefaults)
    })
  }) // << onSet

  describe('toJSON', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      await Physics.load()
      testEntity = createEntity()
      setComponent(testEntity, TriggerComponent)
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it("should serialize the component's data correctly", () => {
      const json = serializeComponent(testEntity, TriggerComponent)
      assert.deepEqual(json, TriggerComponentDefaults)
    })
  }) // << toJson

  describe('reactor', () => {
    let testEntity = UndefinedEntity
    let physicsWorld: World | undefined = undefined

    beforeEach(async () => {
      createEngine()
      await Physics.load()
      physicsWorld = Physics.createWorld()
      physicsWorld!.timestep = 1 / 60
      getMutableState(PhysicsState).physicsWorld!.set(physicsWorld!)

      testEntity = createEntity()
      setComponent(testEntity, TransformComponent)
      setComponent(testEntity, RigidBodyComponent)
      setComponent(testEntity, ColliderComponent)
      setComponent(testEntity, TriggerComponent)
    })

    afterEach(() => {
      removeEntity(testEntity)
      physicsWorld = undefined
      return destroyEngine()
    })

    it("should call Physics.setTrigger on the entity's collider when a new ColliderComponent is set", () => {
      assertColliderComponentEquals(getComponent(testEntity, ColliderComponent), ColliderComponentDefaults)
      removeComponent(testEntity, ColliderComponent)
      const ColliderComponentData = {
        shape: Shapes.Sphere,
        mass: 3,
        massCenter: new Vector3(1, 2, 3),
        friction: 1.0,
        restitution: 0.1,
        collisionLayer: CollisionGroups.Default,
        collisionMask: DefaultCollisionMask
      }
      setComponent(testEntity, ColliderComponent, ColliderComponentData)
      assertColliderComponentEquals(getComponent(testEntity, ColliderComponent), ColliderComponentData)
      const reactor = ColliderComponent.reactorMap.get(testEntity)!
      assert.ok(reactor.isRunning)
      const collider = Physics._Colliders.get(testEntity)!
      assert.ok(collider)
      assert.ok(collider.isSensor())
    })
  }) // << reactor
})
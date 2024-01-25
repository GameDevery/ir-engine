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

import React, { useEffect } from 'react'

import { EntityUUID } from '@etherealengine/common/src/interfaces/EntityUUID'
import { defineState, dispatchAction, getMutableState, none, useHookstate } from '@etherealengine/hyperflux'

import { AvatarID, AvatarType, avatarPath, userAvatarPath } from '@etherealengine/common/src/schema.type.module'
import { Paginated } from '@feathersjs/feathers'
import { isClient } from '../../common/functions/getEnvironment'
import { Engine } from '../../ecs/classes/Engine'
import { entityExists } from '../../ecs/functions/EntityFunctions'
import { defineSystem } from '../../ecs/functions/SystemFunctions'
import { SimulationSystemGroup } from '../../ecs/functions/SystemGroups'
import { WorldNetworkAction } from '../../networking/functions/WorldNetworkAction'
import { UUIDComponent } from '../../scene/components/UUIDComponent'
import { loadAvatarModelAsset, unloadAvatarForUser } from '../functions/avatarFunctions'
import { spawnAvatarReceptor } from '../functions/spawnAvatarReceptor'
import { AvatarNetworkAction } from './AvatarNetworkActions'

export const AvatarState = defineState({
  name: 'ee.engine.avatar.AvatarState',

  initial: {} as Record<
    EntityUUID,
    {
      avatarID: AvatarID
    }
  >,

  receptors: {
    onSpawn: AvatarNetworkAction.spawn.receive((action) => {
      getMutableState(AvatarState)[action.entityUUID].set({ avatarID: action.avatarID })
    }),
    onSetAvatarID: AvatarNetworkAction.setAvatarID.receive((action) => {
      getMutableState(AvatarState)[action.entityUUID].set({ avatarID: action.avatarID })
    }),
    onDestroyObject: WorldNetworkAction.destroyObject.receive((action) => {
      getMutableState(AvatarState)[action.entityUUID].set(none)
    })
  },

  selectRandomAvatar() {
    Engine.instance.api
      .service(avatarPath)
      .find({})
      .then((avatars: Paginated<AvatarType>) => {
        const randomAvatar = avatars.data[Math.floor(Math.random() * avatars.data.length)]
        AvatarState.updateUserAvatarId(randomAvatar.id)
      })
  },

  updateUserAvatarId(avatarId: AvatarID) {
    Engine.instance.api
      .service(userAvatarPath)
      .patch(null, { avatarId: avatarId }, { query: { userId: Engine.instance.userID } })
      .then(() => {
        dispatchAction(
          AvatarNetworkAction.setAvatarID({
            avatarID: avatarId as AvatarID,
            entityUUID: Engine.instance.userID as any as EntityUUID
          })
        )
      })
  }
})

const AvatarReactor = ({ entityUUID }: { entityUUID: EntityUUID }) => {
  const avatarID = useHookstate(getMutableState(AvatarState)[entityUUID].avatarID)
  const userAvatarDetails = useHookstate(null as string | null)
  const entity = UUIDComponent.useEntityByUUID(entityUUID)

  useEffect(() => {
    if (!isClient) return

    let aborted = false

    Engine.instance.api
      .service(avatarPath)
      .get(avatarID.value!)
      .then((avatarDetails) => {
        if (aborted) return

        if (!avatarDetails.modelResource?.url) return

        userAvatarDetails.set(avatarDetails.modelResource.url)
      })

    return () => {
      aborted = true
    }
  }, [avatarID])

  useEffect(() => {
    if (!isClient) return

    if (!entity) return

    if (!userAvatarDetails.value) return

    spawnAvatarReceptor(entityUUID)
    loadAvatarModelAsset(entity, userAvatarDetails.value)
    return () => {
      if (!entityExists(entity)) return
      unloadAvatarForUser(entity)
    }
  }, [userAvatarDetails, entity])

  return null
}

export const AvatarStateReactor = () => {
  const avatarState = useHookstate(getMutableState(AvatarState))
  return (
    <>
      {avatarState.keys.map((entityUUID: EntityUUID) => (
        <AvatarReactor key={entityUUID} entityUUID={entityUUID} />
      ))}
    </>
  )
}

export const AvatarNetworkSystem = defineSystem({
  uuid: 'ee.engine.avatar.AvatarNetworkSystem',
  insert: { with: SimulationSystemGroup },
  reactor: AvatarStateReactor
})

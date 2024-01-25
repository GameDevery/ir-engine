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

import { getMutableState, getState, useHookstate } from '@etherealengine/hyperflux'

import { useEffect } from 'react'
import { AvatarControllerComponent } from '../../avatar/components/AvatarControllerComponent'
import { switchCameraMode } from '../../avatar/functions/switchCameraMode'
import { CameraMode } from '../../camera/types/CameraMode'
import { Engine } from '../../ecs/classes/Engine'
import { getComponent } from '../../ecs/functions/ComponentFunctions'
import { defineSystem } from '../../ecs/functions/SystemFunctions'
import { PresentationSystemGroup } from '../../ecs/functions/SystemGroups'
import { EntityNetworkState } from '../../networking/state/EntityNetworkState'
import { PortalComponent, PortalState } from '../components/PortalComponent'
import { UUIDComponent } from '../components/UUIDComponent'

const reactor = () => {
  const activePortalEntityState = useHookstate(getMutableState(PortalState).activePortalEntity)

  useEffect(() => {
    const activePortalEntity = activePortalEntityState.value
    if (!activePortalEntity) return
    const activePortal = getComponent(activePortalEntity, PortalComponent)
    switchCameraMode(Engine.instance.cameraEntity, { cameraMode: CameraMode.ShoulderCam })
    AvatarControllerComponent.captureMovement(Engine.instance.localClientEntity, activePortalEntity)

    return () => {
      const localClientEntity = Engine.instance.localClientEntity
      getState(EntityNetworkState)[getComponent(localClientEntity, UUIDComponent)].spawnPosition.copy(
        activePortal.remoteSpawnPosition
      )
      AvatarControllerComponent.releaseMovement(Engine.instance.localClientEntity, activePortalEntity)
      getMutableState(PortalState).lastPortalTimeout.set(Date.now())
    }
  }, [activePortalEntityState])

  return null
}

export const PortalSystem = defineSystem({
  uuid: 'ee.engine.PortalSystem',
  insert: { after: PresentationSystemGroup },
  reactor
})

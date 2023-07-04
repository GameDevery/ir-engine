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

import { Object3D } from 'three'

import { matches } from '../../common/functions/MatchesUtils'
import { Entity } from '../../ecs/classes/Entity'
import { defineComponent } from '../../ecs/functions/ComponentFunctions'

export const VehicleComponent = defineComponent({
  name: 'VehicleComponent',

  onInit: (entity) => {
    return {
      vehicleHeight: null! as number,
      vehicleWidth: null! as number,
      vehicleLength: null! as number,
      chassis: null! as Entity,
      axles: null! as Entity[],
      wheels: null! as Entity[],
      jointMap: null! as Map<number, number>
    }
  },

  onSet: (entity, component, json) => {
    if (!json) return
    if (matches.number.test(json.vehicleHeight)) component.vehicleHeight.set(json.vehicleHeight as number)
    if (matches.number.test(json.vehicleWidth)) component.vehicleWidth.set(json.vehicleWidth as number)
    if (matches.number.test(json.vehicleLength)) component.vehicleLength.set(json.vehicleLength as number)
    if (matches.object.test(json.chassis)) component.chassis.set(json.chassis as Entity)
    if (matches.object.test(json.axles)) component.axles.set(json.axles as Entity[])
    if (matches.object.test(json.wheels)) component.axles.set(json.wheels as Entity[])
    if (matches.object.test(json.jointMap)) component.jointMap.set(json.jointMap as Map<number, number>)
  }
})

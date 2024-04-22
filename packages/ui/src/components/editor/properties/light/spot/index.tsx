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

import React from 'react'
import { useTranslation } from 'react-i18next'

import { SpotLightComponent } from '@etherealengine/spatial/src/renderer/components/SpotLightComponent'

import AdjustIcon from '@mui/icons-material/Adjust'

import {
  EditorComponentType,
  commitProperty,
  updateProperty
} from '@etherealengine/editor/src/components/properties/Util'
import ColorInput from '../../../../../primitives/tailwind/ColorInput'
import InputGroup from '../../../input/Group'
import NumericInput from '../../../input/Numeric'
import NodeEditor from '../../nodeEditor'
import LightShadowProperties from '../shadowProperties'

/**
 * SpotLightNodeEditor component class used to provide editor view for property customization.
 */
export const SpotLightNodeEditor: EditorComponentType = (props) => {
  const { t } = useTranslation()

  //const lightComponent = useComponent(props.entity, SpotLightComponent).value

  return (
    <NodeEditor {...props} description={t('editor:properties.spotLight.description')}>
      <InputGroup name="Color" label={t('editor:properties.spotLight.lbl-color')}>
        <ColorInput
          value={
            //lightComponent.color
            undefined
          }
          onChange={updateProperty(SpotLightComponent, 'color')}
        />
      </InputGroup>
      <InputGroup name="Intensity" label={t('editor:properties.spotLight.lbl-intensity')}>
        <NumericInput
          min={0}
          smallStep={0.001}
          mediumStep={0.01}
          largeStep={0.1}
          value={
            //lightComponent.intensity
            0
          }
          onChange={updateProperty(SpotLightComponent, 'intensity')}
          onRelease={commitProperty(SpotLightComponent, 'intensity')}
        />
      </InputGroup>
      <InputGroup name="Penumbra" label={t('editor:properties.spotLight.lbl-penumbra')}>
        <NumericInput
          min={0}
          max={1}
          smallStep={0.01}
          mediumStep={0.1}
          value={
            //lightComponent.penumbra
            0
          }
          onChange={updateProperty(SpotLightComponent, 'penumbra')}
          onRelease={commitProperty(SpotLightComponent, 'penumbra')}
        />
      </InputGroup>
      {/*<RadianNumericInputGroup
        name="Angle"
        label={t('editor:properties.spotLight.lbl-angle')}
        min={0}
        max={90}
        smallStep={0.1}
        mediumStep={1}
        largeStep={10}
        value={lightComponent.angle}
        onChange={updateProperty(SpotLightComponent, 'angle')}
        onRelease={commitProperty(SpotLightComponent, 'angle')}
        unit="°"
      />*/}
      <InputGroup name="Range" label={t('editor:properties.spotLight.lbl-range')}>
        <NumericInput
          min={0}
          smallStep={0.1}
          mediumStep={1}
          largeStep={10}
          value={
            //lightComponent.range
            0
          }
          onChange={updateProperty(SpotLightComponent, 'range')}
          onRelease={commitProperty(SpotLightComponent, 'range')}
          unit="m"
        />
      </InputGroup>
      <InputGroup name="Decay" label={t('editor:properties.spotLight.lbl-decay')}>
        <NumericInput
          min={0}
          max={10}
          smallStep={0.1}
          mediumStep={1}
          value={
            //lightComponent.decay
            0
          }
          onChange={updateProperty(SpotLightComponent, 'decay')}
          onRelease={commitProperty(SpotLightComponent, 'decay')}
        />
      </InputGroup>
      <LightShadowProperties entity={props.entity} comp={SpotLightComponent} />
    </NodeEditor>
  )
}

SpotLightNodeEditor.iconComponent = AdjustIcon

export default SpotLightNodeEditor

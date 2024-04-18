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

import CheckIcon from '@mui/icons-material/Check'
import React, { KeyboardEvent, useState } from 'react'

let uniqueId = 0

interface BooleanInputProp {
  value: boolean
  onChange: (value: boolean) => void
  onRelease?: (value: boolean) => void
  disabled?: boolean
}

export const BooleanInput = (props: BooleanInputProp) => {
  const [checkboxId] = useState(() => `boolean-input-${uniqueId++}`)

  const onChange = (e) => {
    props.onChange(e.target.checked)
  }

  const onBlur = (e) => {
    if (props.onRelease) props.onRelease(props.value)
  }

  const onKeyPress = (e: KeyboardEvent<HTMLLabelElement>) => {
    if (e.key === 'Enter' || e.key === ' ') props.onChange(!props.value)
  }

  return (
    <div className="flex items-center justify-center">
      <input
        id={checkboxId}
        className="hidden"
        type="checkbox"
        checked={props.value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={props.disabled}
      />
      <label
        htmlFor={checkboxId}
        className={`w-18 h-18 flex cursor-pointer items-center justify-center p-0 ${
          props.disabled ? 'grayscale-80 cursor-not-allowed opacity-80 filter' : ''
        }`}
        tabIndex={0}
        onKeyPress={onKeyPress}
      >
        {props.value && <CheckIcon className="text-buttonTextColor h-auto w-full" />}
      </label>
    </div>
  )
}

export default BooleanInput

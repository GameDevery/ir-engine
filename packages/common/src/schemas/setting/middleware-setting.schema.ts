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

// For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import type { Static } from '@feathersjs/typebox'
import { getValidator, querySyntax, Type } from '@feathersjs/typebox'
import { dataValidator, queryValidator } from '../validators'

export const middlewareSettingPath = 'middleware-setting'

// Middleware API
export const middlewareApiUrl = 'middleware-api'

export const middlewareSettingMethods = ['get', 'find', 'create', 'patch', 'remove', 'update'] as const

// Main data model schema
export const middlewareSettingSchema = Type.Object(
  {
    id: Type.String({
      format: 'uuid'
    }),
    middlewareProject: Type.String(),
    middlewareProjectName: Type.String(),
    middlewareSettingTemp: Type.String(),
    middlewareSettingMenu: Type.String(),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' })
  },
  { $id: 'MiddlewareSetting', additionalProperties: false }
)
export interface MiddlewareSettingType extends Static<typeof middlewareSettingSchema> {}

// API data model schema
export const middlewareApiSchema = Type.Object(
  {
    id: Type.String({
      format: 'uuid'
    }),
    middlewareUrl: Type.String(),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' })
  },
  { $id: 'MiddlewareSetting', additionalProperties: false }
)
export interface MiddlewareApiType extends Static<typeof middlewareApiSchema> {}

export interface MiddlewareSettingDatabaseType
  extends Omit<
    MiddlewareSettingType,
    'middlewareProject' | 'middlewareProjectName' | 'middlewareSettingTemp' | 'middlewareSettingMenu'
  > {
  middlewareProject: string
  middlewareProjectName: string
  middlewareSettingTemp: string
  middlewareSettingMenu: string
}

// Middleware API
export interface MiddlewareApiDatabaseType extends Omit<MiddlewareApiType, 'middlewareUrl'> {
  middlewareUrl: string
}

// Schema for creating new entries
export const middlewareSettingDataSchema = Type.Pick(
  middlewareSettingSchema,
  ['middlewareProject', 'middlewareProjectName', 'middlewareSettingTemp', 'middlewareSettingMenu'],
  {
    $id: 'MiddlewareSettingData'
  }
)
export interface MiddlewareSettingData extends Static<typeof middlewareSettingDataSchema> {}

// Middleware API
export const middlewareSettingApiSchema = Type.Pick(middlewareSettingSchema, ['middlewareUrl'], {
  $id: 'MiddlewareSettingApi'
})
export interface MiddlewareSettingApi extends Static<typeof middlewareSettingApiSchema> {}

// Schema for updating existing entries
export const middlewareSettingPatchSchema = Type.Partial(middlewareSettingSchema, {
  $id: 'MiddlewareSettingPatch'
})
export interface MiddlewareSettingPatch extends Static<typeof middlewareSettingPatchSchema> {}

// Middleware API
export const middlewareSettingApiPatchSchema = Type.Partial(middlewareSettingApiSchema, {
  $id: 'MiddlewareSettingApiPatch'
})
export interface MiddlewareSettingApiPatch extends Static<typeof middlewareSettingApiPatchSchema> {}

// Schema for allowed query properties
export const middlewareSettingQueryProperties = Type.Pick(middlewareSettingSchema, ['id'])
export const middlewareSettingQuerySchema = Type.Intersect(
  [
    querySyntax(middlewareSettingQueryProperties),
    // Add additional query properties here
    Type.Object({}, { additionalProperties: false })
  ],
  { additionalProperties: false }
)
export interface MiddlewareSettingQuery extends Static<typeof middlewareSettingQuerySchema> {}

// Middleware API
export const middlewareSettingApiQueryProperties = Type.Pick(middlewareSettingApiSchema, ['id'])
export const middlewareSettingApiQuerySchema = Type.Intersect(
  [
    querySyntax(middlewareSettingApiQueryProperties),
    // Add additional query properties here
    Type.Object({}, { additionalProperties: false })
  ],
  { additionalProperties: false }
)
export interface MiddlewareSettingApiQuery extends Static<typeof middlewareSettingApiQuerySchema> {}
//

export const middlewareSettingDataValidator = /* @__PURE__ */ getValidator(middlewareSettingDataSchema, dataValidator)
export const middlewareSettingPatchValidator = /* @__PURE__ */ getValidator(middlewareSettingPatchSchema, dataValidator)
export const middlewareSettingQueryValidator = /* @__PURE__ */ getValidator(
  middlewareSettingQuerySchema,
  queryValidator
)

// Middleware API
export const middlewareSettingApiValidator = /* @__PURE__ */ getValidator(middlewareSettingApiSchema, dataValidator)
export const middlewareSettingApiPatchValidator = /* @__PURE__ */ getValidator(
  middlewareSettingApiPatchSchema,
  dataValidator
)
export const middlewareSettingApiQueryValidator = /* @__PURE__ */ getValidator(
  middlewareSettingApiQuerySchema,
  queryValidator
)
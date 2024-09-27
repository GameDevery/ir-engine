/*
CPAL-1.0 License

The contents of this file are subject to the Common Public Attribution License
Version 1.0. (the "License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at
https://github.com/ir-engine/ir-engine/blob/dev/LICENSE.
The License is based on the Mozilla Public License Version 1.1, but Sections 14
and 15 have been added to cover use of software over a computer network and 
provide for limited attribution for the Original Developer. In addition, 
Exhibit A has been modified to be consistent with Exhibit B.

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the
specific language governing rights and limitations under the License.

The Original Code is Infinite Reality Engine.

The Original Developer is the Initial Developer. The Initial Developer of the
Original Code is the Infinite Reality Engine team.

All portions of the code written by the Infinite Reality Engine team are Copyright © 2021-2023 
Infinite Reality Engine. All Rights Reserved.
*/

import { Paginated, ServiceInterface } from '@feathersjs/feathers'
import { KnexAdapterParams } from '@feathersjs/knex'

import { GenerateTokenData, GenerateTokenQuery } from '@ir-engine/common/src/schemas/user/generate-token.schema'
import { IdentityProviderType, identityProviderPath } from '@ir-engine/common/src/schemas/user/identity-provider.schema'

import { Application } from '../../../declarations'

export interface GenerateTokenParams extends KnexAdapterParams<GenerateTokenQuery> {
  authentication?: any
  policy?: string
  expiresIn?: number | string
}

export interface JWTPayload {
  pol?: string
}

export interface JWTOptions {
  subject: string
  expiresIn?: string | number
}

/**
 * A class for GenerateToken service
 */

export class GenerateTokenService
  implements ServiceInterface<GenerateTokenData | null, GenerateTokenData, GenerateTokenParams>
{
  app: Application

  constructor(app: Application) {
    this.app = app
  }

  async create(data: GenerateTokenData, params: GenerateTokenParams) {
    const userId = params?.user?.id
    if (!data.token || !data.type) throw new Error('Must pass service and identity-provider token to generate JWT')
    const ipResult = (await this.app.service(identityProviderPath).find({
      query: {
        userId: userId,
        type: data.type,
        token: data.token
      }
    })) as Paginated<IdentityProviderType>
    if (ipResult.total > 0) {
      const ip = ipResult.data[0]

      const payload: JWTPayload = {}
      const opts: JWTOptions = { subject: ip.id.toString() }
      if (params.policy) payload.pol = params.policy
      if (params.expiresIn) opts.expiresIn = params.expiresIn
      const newToken = await this.app.service('authentication').createAccessToken(payload, opts)
      return {
        token: newToken,
        type: data.type
      }
    } else return null
  }
}

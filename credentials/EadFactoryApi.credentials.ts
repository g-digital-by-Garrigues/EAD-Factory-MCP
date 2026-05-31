import {
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class EadFactoryApi implements ICredentialType {
  name = 'eadFactoryApi';
  displayName = 'EAD Factory API';
  documentationUrl = 'https://github.com/g-digital-by-Garrigues/EAD-Factory-MCP';

  properties: INodeProperties[] = [
    {
      displayName: 'Evidence API Base URL',
      name: 'API_BASE_URL',
      type: 'string',
      default: 'https://api.gcloudfactory.com/digital-trust',
      description: 'Base URL of the Evidence Manager API. Production (AWS): https://api.gcloudfactory.com/digital-trust',
    },
    {
      displayName: 'Signature API Base URL',
      name: 'SIGNATURE_API_BASE_URL',
      type: 'string',
      default: 'https://api.gcloudfactory.com/signature-manager',
      description: 'Base URL of the Signature Manager API. Production (AWS): https://api.gcloudfactory.com/signature-manager',
    },
    {
      displayName: 'Okta Token URL',
      name: 'OKTA_TOKEN_URL',
      type: 'string',
      default: '',
      description: 'Okta token endpoint for client_credentials grant. See README for per-environment URLs.',
    },
    {
      displayName: 'Okta Client ID',
      name: 'OKTA_CLIENT_ID',
      type: 'string',
      default: '',
      description: 'Okta client ID.',
    },
    {
      displayName: 'Okta Client Secret',
      name: 'OKTA_CLIENT_SECRET',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'Okta client secret.',
    },
    {
      displayName: 'Okta Scope',
      name: 'OKTA_SCOPE',
      type: 'string',
      default: 'token',
      description: 'OAuth scope for the client_credentials grant.',
    },
  ];

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.OKTA_TOKEN_URL}}',
      url: '',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials&client_id={{$credentials.OKTA_CLIENT_ID}}&client_secret={{$credentials.OKTA_CLIENT_SECRET}}&scope={{$credentials.OKTA_SCOPE}}',
    },
  };
}

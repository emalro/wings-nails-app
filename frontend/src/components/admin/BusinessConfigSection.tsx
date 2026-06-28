import React from 'react'

type ConfigForm = {
  business_name: string
  facebook_url: string
  instagram_url: string
  whatsapp_number: string
  address: string
  cbu_alias: string
  cbu_number: string
}

type BusinessConfigSectionProps = {
  configForm: ConfigForm
  setConfigForm: React.Dispatch<React.SetStateAction<ConfigForm>>
  configLoading: boolean
  updateConfigMutation: { isPending: boolean }
  configMessage: string | null
  handleUpdateConfig: (e: React.FormEvent) => void
}

export default function BusinessConfigSection({
  configForm,
  setConfigForm,
  configLoading,
  updateConfigMutation,
  configMessage,
  handleUpdateConfig,
}: BusinessConfigSectionProps) {
  return (
    <>
      {configMessage && <div className="status-notice success">{configMessage}</div>}
      {configLoading ? (
        <p>Cargando configuración...</p>
      ) : (
        <form onSubmit={handleUpdateConfig} className="service-form">
          <label>
            Nombre del emprendimiento
            <input value={configForm.business_name} onChange={e => setConfigForm({ ...configForm, business_name: e.target.value })} />
          </label>
          <label>
            URL de Facebook
            <input value={configForm.facebook_url} onChange={e => setConfigForm({ ...configForm, facebook_url: e.target.value })} placeholder="https://facebook.com/..." />
          </label>
          <label>
            URL de Instagram
            <input value={configForm.instagram_url} onChange={e => setConfigForm({ ...configForm, instagram_url: e.target.value })} placeholder="https://instagram.com/..." />
          </label>
          <label>
            Número de WhatsApp (sin + ni espacios)
            <input value={configForm.whatsapp_number} onChange={e => setConfigForm({ ...configForm, whatsapp_number: e.target.value })} placeholder="5493412345678" />
          </label>
          <label>
            Dirección del local
            <input value={configForm.address} onChange={e => setConfigForm({ ...configForm, address: e.target.value })} placeholder="Rosario, Santa Fe" />
          </label>
          <label>
            CBU / Alias
            <input value={configForm.cbu_alias} onChange={e => setConfigForm({ ...configForm, cbu_alias: e.target.value })} placeholder="mi.alias.mp" />
          </label>
          <label>
            CBU / Número
            <input value={configForm.cbu_number} onChange={e => setConfigForm({ ...configForm, cbu_number: e.target.value })} placeholder="0000003100000000000001" />
          </label>
          <button className="button-primary" type="submit" disabled={updateConfigMutation.isPending}>
            {updateConfigMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </form>
      )}
    </>
  )
}
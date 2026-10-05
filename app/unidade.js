import { UNIDADES } from '../lib/regras/dfc-fonte.mjs';

export default function FiltroDeUnidade({ escolhida }) {
  return <label className="campo-filtro">
    <span>unidade do DFC</span>
    <select name="unidade" defaultValue={UNIDADES.includes(escolhida) ? escolhida : ''}>
      <option value="">consolidado</option>
      {UNIDADES.map((u) => <option value={u} key={u}>{u}</option>)}
    </select>
  </label>;
}

---
name: visualizacao-de-dados
description: Como desenhar qualquer tela, painel ou gráfico deste repositório. É a skill de visualização de dados que o dono mandou em 28/09/2026, com as adaptações da MeuBESS no topo. Use ao refazer o layout de uma das três telas, ao acrescentar um gráfico ou um indicador a uma delas, ou ao escolher cor, eixo, rótulo e ordem de qualquer desenho.
---

# Visualização de dados — a skill do dono, adaptada à MeuBESS

**O que vem primeiro.** As adaptações abaixo são do dono (28/09/2026) e **valem mais que a skill**: onde as duas
discordarem, mandam elas. A skill original vem inteira logo em seguida, sem corte.

## As adaptações da MeuBESS

1. **Nada de MotherDuck, DuckDB nem app Vite à parte.** As três telas moram no app Next deste repositório e os dados
   vêm da camada que já existe (`lib/dados.mjs` e `lib/indicadores/`). A **Fase 0** da skill — escolher entre modo
   local e MotherDuck — **não se aplica**: o modo é sempre este app. A **Fase 2** (inspecionar a tabela com DuckDB)
   também não: a forma das fontes está levantada, coluna por coluna, em `docs/fontes.md`, que é mais completo do que
   um `DESCRIBE` devolveria. Biblioteca de gráfico só como **dependência npm local** — Recharts, a preferida da
   própria skill. **Nenhum número sai desta máquina**, e nenhum serviço de fora é chamado.

2. **Recharts 2, com largura e altura fixas e sem animação.** `scripts/capturar-tela.mjs` joga fora todo `<script>`
   da página antes de gravar a captura, então **o gráfico tem de sair pronto do servidor**. Daí três amarras, todas
   conferidas em 28/09/2026 e escritas em `app/graficos.js`:
   - o **Recharts 3 devolve uma caixa vazia** no servidor; o **2.15.4** desenha o SVG inteiro;
   - **`ResponsiveContainer` não serve** (ele mede o elemento no navegador): largura e altura vão fixas, e quem faz o
     desenho acompanhar o painel é o `viewBox` do SVG, pelo CSS;
   - **`isAnimationActive={false}` em tudo**: com animação o primeiro desenho é o quadro zero, e é ele que vai para o
     HTML.

3. **Todo dinheiro sai por `app/dinheiro.js`**, no formato `R$ 1.634.743`. É essa forma, letra por letra, que a troca
   de `scripts/capturar-tela.mjs` sabe apagar. Um formato novo faria dinheiro entrar em arquivo versionado.

4. **Nome de cliente sempre marcado.** Toda aparição de nome de cliente — em HTML ou dentro do SVG — leva
   `class="cliente"` e `data-codigo="…"`, para a captura trocar o nome pelo código. A trava da captura recusa o
   arquivo se sobrar um `data-codigo`.

5. **Nenhuma cor escrita no componente.** As cores da marca moram todas em `app/globals.css`. Cada série leva uma
   `className` e pinta com `currentColor`; quem diz a cor é o CSS.

6. **Só o visual muda.** Refazer um layout **não pode** mudar número, indicador, filtro, regra nem a trava de agosto.
   Disso decorrem duas coisas que a skill pede e aqui não valem:
   - **linha de referência de média, meta ou benchmark é número novo** — só entram referências que não inventam nada
     (o período em foco, a linha do zero);
   - **filtro cruzado (clicar numa barra para filtrar o resto) é filtro novo** — os filtros são decisão do dono,
     moram na URL e estão conferidos em `docs/filtros.md`.
   Prova de que nada mudou: `npm run conferir-telas` (36 conferidos) e `npm run conferir-filtros` (19 conferidos).

7. **A frase de "o filtro não vale" é parte do número.** Ela fica dentro do cartão, do gráfico ou da linha da tabela
   (`app/filtrado.js`), nunca numa nota de rodapé nem escondida atrás de um `<details>`.

8. **A história não se pergunta ao dono no meio do trabalho.** As quatro perguntas da Fase 1 (público, decisão,
   mensagem de 5 segundos, perguntas que a tela responde) e a do tema são respondidas a partir de `docs/fontes.md`,
   de `docs/referencias/` — as imagens dizem **quais blocos** cada tela tem; o visual é da skill — e da marca em
   `public/marca/`, e ficam **escritas em `docs/layout.md` para o dono corrigir**. O tema já escolhido é
   **"clean analytical" com as cores da marca**.

9. **O resultado se registra em dois lugares, sempre:** o plano e o checklist em `docs/layout.md`, e a captura da
   tela em `docs/tela-N-captura.html`, gerada por `node scripts/capturar-tela.mjs --tela N` com o app no ar. A página
   que o dono lê é `docs/layout.html`, escrita por `node scripts/pagina-de-layout.mjs`.

---

# Data Visualization Expert Skill

You are a data visualization expert. You help users build effective, well-designed dashboards from their data.

**You do NOT start generating charts immediately.** You follow a structured process: understand the story first, inspect the data, then build the visualization step by step.

---

## Phase 0: Environment Setup (mandatory — do not skip)

Before anything else, ask:

> **Where does your data live, and where should the output go?**
>
> - **Local files** (CSV, Parquet, JSON, Excel, local DuckDB) → I'll query with Python + DuckDB and build a local Vite/React app
> - **MotherDuck** (cloud DuckDB) → I'll query via the MotherDuck MCP and output a MotherDuck Dive

Remember the chosen mode — it governs data inspection (Phase 2) and output generation (Phase 4).

---

## Phase 1: The Story (mandatory — do not skip)

Before touching any data, ask the user these questions **one at a time**. Do not proceed until all are answered:

### Question 1: Audience
> **Who is this dashboard for?**
> A policy maker? A CEO? Engineers? General public? The audience shapes everything — level of detail, language, complexity.

Wait for the answer.

### Question 2: Decision
> **What decision should this dashboard help someone make?**
> If nobody acts on it, it's decoration. Give me a concrete example: "Should we invest more in region X?", "Is our air quality improving?", "Which team needs more resources?"

Wait for the answer.

### Question 3: Key takeaway
> **If someone looks at this dashboard for 5 seconds, what's the ONE thing they should walk away with?**
> Not three things. One. Everything else supports this.

Wait for the answer.

### Question 4: Questions to answer
> **What specific questions should the dashboard answer?**
> List 2-5 sub-questions. Example: "How does my city compare to others?", "Which regions improved the most?", "Is there a correlation between PM2.5 and NO2?"

Wait for the answer.

Once all four are answered, summarize the story back to the user:

```
Here's what I understand:
- Audience: [...]
- Decision: [...]
- Key takeaway: [...]
- Questions: [...]

Does this look right? I'll use this to guide every chart choice and design decision.
```

---

## Phase 2: The Data

### Question 5: Data source
> **What's the table name or file path?**
> I'll inspect it before building anything.

Once provided, inspect the data using the appropriate method for the chosen mode:

**Local mode** — run via `uv run python`:
```python
import duckdb
con = duckdb.connect()
print(con.execute("SELECT * FROM '[path]' LIMIT 5").df())
print(con.execute("DESCRIBE SELECT * FROM '[path]'").df())
print(con.execute("SELECT COUNT(*) FROM '[path]'").fetchone())
```

**MotherDuck mode** — use the MotherDuck MCP `query` tool:
```sql
SELECT * FROM [table] LIMIT 5;
DESCRIBE SELECT * FROM [table];
SELECT COUNT(*) AS total_rows FROM [table];
```

After inspecting, present findings to the user:

```
Here's what I found in your data:
- [X] rows, [Y] columns
- Key columns: [list with types]
- Time column: [if any — name, range, granularity]
- Categorical columns: [name, cardinality]
- Numeric columns: [name, range, distribution notes]
- Data quality: [nulls, outliers, anything surprising]

Based on your questions and this data shape, here's my chart plan:
```

---

## Phase 3: Chart Selection

For every chart, **walk this tree top-down, state the path you took, and justify the leaf node you land on.**

```
What kind of data?
│
├── NUMERIC only
│   ├── 1 variable
│   │   └── → Histogram, Density Plot
│   ├── 2 variables
│   │   ├── ordered (one is time/sequence)
│   │   │   └── → Line, Area, Connected Scatter
│   │   └── unordered
│   │       ├── few points (<2000) → Scatter, Box Plot, Violin
│   │       └── many points       → 2D Density, Hex Bin, Violin
│   ├── 3 variables
│   │   ├── ordered   → Line, Stacked Area, Streamgraph
│   │   └── unordered → Bubble, Violin, Box Plot
│   └── several variables
│       ├── ordered   → Stacked Area, Streamgraph, Heatmap, Ridgeline
│       └── unordered → Heatmap, Correlogram, PCA, Ridgeline, Box/Violin
│
├── CATEGORIC only
│   ├── 1 variable
│   │   └── → Bar, Lollipop, Pie, Donut, Treemap, Word Cloud, Waffle
│   └── 2+ variables
│       ├── nested (hierarchy: e.g. continent > country > city)
│       │   └── → Treemap, Sunburst, Dendrogram, Circular Packing
│       ├── subgroup (every combination: e.g. gender × age)
│       │   └── → Grouped Bar, Stacked Bar, Spider/Radar, Heatmap, Parallel Plot
│       ├── two independent lists (overlap is the goal)
│       │   └── → Venn Diagram
│       └── adjacency (flows between lists)
│           └── → Sankey, Chord, Arc Diagram, Network
│
├── NUMERIC + CATEGORIC (mixed)
│   ├── one observation per group
│   │   ├── 1 numeric
│   │   │   └── → Bar, Lollipop, Pie, Donut, Treemap
│   │   └── several numerics
│   │       ├── one numeric is ordered → Line, Area, Stacked Area, Streamgraph
│   │       └── none ordered          → Grouped Bar, Stacked Bar, Heatmap, Spider, Parallel
│   └── several observations per group (distributions)
│       └── → Violin, Box Plot, Ridgeline, Density, Histogram
│
├── TIME SERIES
│   ├── 1 series  → Bar, Lollipop, Line, Area, Ridgeline, Box/Violin
│   └── several series
│       ├── few series (<7) → Multi-line, Stacked Area, Streamgraph
│       └── many series     → Heatmap, Ridgeline, Small Multiples
│
├── GEOGRAPHIC
│   ├── points (lat/lon)     → Bubble Map, Hex Bin Map, Connection Map
│   ├── regions (boundaries) → Choropleth Map
│   └── structure only       → Basic Map
│
└── NETWORK / RELATIONAL
    ├── non-hierarchical (free connections)
    │   └── → Network, Hive Plot, Heatmap (adj. matrix), Sankey, Arc/Chord
    └── hierarchical (parent → child)
        ├── values on edges  → Chord, Sankey, Dendrogram, Edge Bundling
        ├── values on leaves → Treemap, Sunburst, Circular Packing, Sankey, Dendrogram
        └── structure only   → Dendrogram, Sunburst, Circular Packing, Treemap
```

### Anti-patterns (always avoid)
- Pie charts with more than 5 slices → use bar or table
- 3D charts of any kind → always 2D
- Dual y-axes with unrelated metrics → use separate charts
- Line charts with more than 7 series → use small multiples
- Truncated y-axes on bar charts → always start at zero
- Rainbow palettes with no semantic meaning → use intentional palettes

Present the chart plan as a table:

```
| Your question | Data path in tree | Chart type | Why |
|--------------|-------------------|-----------|-----|
| "Is PM2.5 improving?" | Time series → 1 series → | Line chart | ordered time axis, single metric |
| "Which regions are worst?" | Numeric + Categoric → 1 obs/group → 1 numeric → | Horizontal bar | categorical ranking |
```

Ask: **"Does this chart plan make sense? Want to change anything before I build?"**

---

## Phase 4: Build the Dashboard

### Layout (follow the F-pattern)
1. **Title + subtitle** — the key takeaway as a sentence
2. **KPI cards** — headline numbers in a row
3. **Primary chart** — most important trend (top-left, largest)
4. **Supporting charts** — comparisons and breakdowns
5. **Detail table** — exact numbers for drill-down

### Design rules (apply automatically)
- **Data-ink ratio:** Remove borders, shadows, excessive gridlines. Light gray horizontal gridlines only.
- **Color:** Sequential palette for magnitude. Max 5-7 colors. Same color = same meaning across all charts.
- **Reference lines:** Add thresholds, benchmarks, or guidelines where relevant.
- **Context:** Include data source and time period as a footnote.
- **Labels:** Direct labeling over legends when possible. Round to meaningful precision.

### Narrative structure
- Section headers tell the story, not describe the chart ("Regional disparities" not "Bar chart of regions")
- Flow: context → tension → insight → action

### Before generating code, ask:
> **Do you have a brand or theme preference?**
> - "Tufte minimal" — maximum data-ink ratio, almost no decoration
> - "Financial Times" — salmon background, authoritative serif headers
> - "Dark mode" — dark background, bright accents, high contrast
> - "Clean analytical" — white background, sans-serif, institutional clarity
>
> Or give me hex values and I'll match your brand.

### Output — local mode
Generate a **Vite + React component** using Recharts (preferred) or Observable Plot:
- Single `.jsx` file, self-contained
- Data fetched via DuckDB-WASM or hardcoded from the query results
- Run with `npm run dev` in the `.dive-preview/` folder

### Output — MotherDuck mode
Generate a **Dive JSX component**:
- Single `.jsx` file following the Dive component conventions
- Queries run inside the component using the MotherDuck Dive data API
- Save to the Dive using the MotherDuck MCP `save_dive` or `edit_dive_content` tool
- Preview at `https://app.motherduck.com/dives/[dive-id]`

---

## Phase 5: Review & Iterate

After generating the dashboard, run through this checklist with the user:

- [ ] Can someone understand the main takeaway in 5 seconds?
- [ ] Does every chart answer a specific question?
- [ ] Is there a clear visual hierarchy (not everything screaming for attention)?
- [ ] Would it still work printed in grayscale?
- [ ] Are reference lines and data sources included?
- [ ] Is the color palette consistent and meaningful?
- [ ] Does the narrative flow top-to-bottom (context → insight → action)?

Ask: **"How does this look? What would you change?"**

Iterate based on feedback. Don't regenerate everything — make targeted adjustments.

---

## Interactivity (suggest proactively)

Once the base dashboard is solid, suggest interactivity:

> **Want to add interactivity?** I'd recommend:
> - **Cross-filtering** — click a bar/region to filter all other charts
> - **Time range filter** — toggle between periods or use a slider
> - **Metric toggle** — switch between different measures with one control
>
> I'll keep it to 1-2 global filters. No dropdown overload.

---

## Reference: Tools for color palettes
- [Colorbrewer 2.0](https://colorbrewer2.org/) — colorblind-safe sequential/diverging/qualitative palettes
- [Viz Palette](https://projects.susielu.com/viz-palette) — test your palette for colorblind accessibility

## Reference: Chart decision frameworks
- [From Data to Viz](https://www.data-to-viz.com/) — full decision tree with 38 chart types
- [FT Visual Vocabulary](https://ft.com/vocabulary) — 9 data relationships mapped to chart types
- [The Graphic Continuum](https://policyviz.com/2014/09/09/graphic-continuum/) — 90+ chart types by complexity

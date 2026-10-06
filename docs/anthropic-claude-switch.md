# Átállás OpenAI → Claude (Anthropic) API

A rendszer AI-hívásai egyetlen ponton (`server/_core/llm.ts` → `invokeLLM`) mennek át.
A Claude (Anthropic) támogatás **kész és tesztelt**, de **alapból KIKAPCSOLVA** — amíg
nem állítod be az alábbiakat, minden az eddigi OpenAI-nal fut tovább. A viselkedés
(generált tartalom, Copilot, ötletek, cégelemzés) **ugyanaz** marad, csak a modell vált.

## 1. Anthropic fiók + API-kulcs

1. Regisztrálj: <https://console.anthropic.com>
2. **Billing** → tölts fel egy kis keretet (pay-as-you-go).
3. **API Keys** → *Create Key* → másold ki (egyszer látszik!). A kulcs így kezdődik: `sk-ant-...`

## 2. Railway Variables (3 env-változó)

A Railway → a szolgáltatás → **Variables**:

| Változó | Érték |
|---|---|
| `ANTHROPIC_API_KEY` | a `sk-ant-...` kulcsod |
| `LLM_PROVIDER` | `anthropic` |
| `LLM_MODEL` | a választott modell (lásd lent) |

A mentés **automatikus újradeployt** indít.

## 3. Modellválasztás (`LLM_MODEL`)

A rendszer alapértéke `claude-opus-5-5`, de **ezt felül kell írnod** a költség/minőség
szerint (ez a mezőnk magas volumenű tartalom-generálás, ezért a modell fontos):

| Modell (`LLM_MODEL`) | Mikor | Ár (be/ki / 1M token) |
|---|---|---|
| `claude-haiku-4-5` | **Leggyorsabb/legolcsóbb** — a mostani gpt-4o-mini-hez hasonló szint | $1 / $5 |
| `claude-sonnet-5-5` | **Ajánlott egyensúly** — erős minőség, elérhető ár | $2 / $10 |
| `claude-opus-5-5` | Legmagasabb minőség, drágább | $4 / $20 |

Kezdéshez a **`claude-sonnet-5-5`** jó választás; ha a költség a fő szempont,
`claude-haiku-4-5`.

## 4. Ellenőrzés deploy után

A Railway **Deploy logs**-ban keresd ezt a sort (induláskor írja ki):

```
[LLM] Aktív provider: anthropic | model: claude-sonnet-5-5 | API kulcs: ✓ beállítva
```

Ha ✓-t látsz, jó. Utána teszteld élőben: **AI Író** (generálj egy posztot), **Copilot**
(kérj egy posztot → megerősítés), **Ötletbank** (AI-ötletek). A viselkedésnek egyeznie
kell a mostanival.

## 5. Visszaállás OpenAI-ra (bármikor, azonnal)

Ha vissza akarsz váltani: a Railway Variables-ben állítsd `LLM_PROVIDER=openai`
(vagy töröld a változót, ha van `OPENAI_API_KEY`). Újradeploy után megint OpenAI-nal fut.
Nincs kód-módosítás, nincs adatvesztés.

## Megjegyzések

- Ha `LLM_PROVIDER=anthropic`, de az `ANTHROPIC_API_KEY` hiányzik, a boot-log `✗ HIÁNYZIK`-ot
  ír, és az AI-hívások érthető hibát adnak (502) — ilyenkor pótold a kulcsot.
- A havi AI-kvóta, a tartalom-ellenőrző és minden más funkció változatlanul működik; csak a
  háttérben lévő LLM-szolgáltató változik.
- Technikai háttér: a `server/_core/anthropicAdapter.ts` fordítja az OpenAI-stílusú hívásokat
  az Anthropic Messages API-ra és vissza; a `response_format: json_schema` megfelelője egy
  `strict` eszköz + `tool_choice: auto` (minden Claude-modellen működik).

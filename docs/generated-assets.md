# Сгенерированные растровые ассеты

Ассеты созданы 13 июля 2026 года встроенным режимом `imagegen`, затем локально очищены от однотонного фона `#ff00ff` скриптом `remove_chroma_key.py`.

## Profit Doctor — основной кадр

Файл: `public/images/profit-doctor-mascot.png`.

Референс стиля: пользовательский скриншот `codex-clipboard-2597ee64-8a0a-4039-980f-debf29084ba9.png`. Референс использован только для пропорций и характера пиксельного персонажа, без копирования дизайна.

Промт:

```text
Use case: stylized-concept
Asset type: transparent landing-page mascot sprite
Input images: Image 1 is a style and proportion reference only; create an original character, do not copy its exact design.
Primary request: Create a cute original pixel-art mascot named Profit Doctor for a marketplace profit analytics SaaS.
Subject: a small friendly medical robot with a large rounded-square head, compact full body, short arms and legs, a dark face screen with two gentle mint eyes, a tiny doctor head mirror, a stethoscope, and a small violet tablet showing a rising profit chart. The character should read instantly at 64–96 px.
Style/medium: polished 16-bit pixel art sprite, deliberate square pixels, crisp stepped edges, compact game-character proportions similar in charm and readability to the reference.
Composition/framing: one full-body character centered, front three-quarter view, generous even padding, no cropping.
Color palette: deep emerald outlines, mint and lime body, off-white doctor accents, small violet chart accent. Do not use magenta in the character.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local background removal; one uniform color, no shadows, gradients, texture, floor plane, reflections, or lighting variation.
Constraints: strong silhouette; symmetrical stable pose; readable face; no text, no letters, no watermark, no extra props, no cast shadow, no contact shadow.
```

## Profit Doctor — взмах рукой

Файл: `public/images/profit-doctor-mascot-wave.png`.

Референс идентичности: `public/images/profit-doctor-mascot.png`.

Промт:

```text
Use case: identity-preserve
Asset type: second frame for a two-frame pixel-art mascot animation
Input images: Image 1 is the exact character identity and still-pose reference.
Primary request: Create the same Profit Doctor pixel-art robot in a waving pose. Change only the character's free right arm: raise it beside the head in a clear friendly wave with the small hand tilted outward. Keep the tablet in the left hand.
Style/medium: match Image 1 exactly — polished 16-bit pixel art, same deliberate square pixel size, same outline thickness, same proportions and rendering.
Composition/framing: same full-body scale, same centered position, same front three-quarter view, same padding as Image 1.
Color palette: preserve the exact deep emerald, mint, lime, off-white, and violet colors from Image 1.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background; one uniform color, no shadows, gradients, texture, floor plane, reflections, or lighting variation.
Constraints: preserve the exact head, face, eyes, head mirror, body, coat, stethoscope, tablet, feet, silhouette scale, and personality; change only the free arm into a raised waving pose. No text, no watermark, no extra props, no cast shadow. Do not use magenta in the character.
```

## Демо-диагностика

Файл: `public/images/profit-diagnostic-card.png`.

Референсы: пользовательский скриншот `codex-clipboard-d26c1ebe-a10c-43ac-a7c1-c935cfc8697c.png` и основной кадр маскота.

Промт:

```text
Use case: precise-object-edit
Asset type: single raster hero dashboard card for a SaaS landing page
Input images: Image 1 is the UI card edit target; Image 2 is the exact mascot character to insert.
Primary request: Turn Image 1 into one clean, straight, polished PNG dashboard card. Remove the crooked layered-paper construction, offset pale backing, extra outline, and all rotation. The card must be a single perfectly aligned rounded rectangle viewed straight-on.
Keep the information architecture and every piece of Russian text and every number from Image 1 verbatim: "ДИАГНОСТИКА МАГАЗИНА", "Май 2026", "ДЕМО", "Выручка" "416 860 ₽", "Прибыль" "+17 800 ₽", "Маржа" "4,3%", "Здоровье ассортимента" "58 / 100", "3 товара требуют внимания", "Они забрали 18 350 ₽ прибыли за период", "КОММЕНТАРИЙ PROFIT DOCTOR", "Начнём с трёх SKU, которые тянут маржу вниз", "Учебные данные — не результат реального магазина".
Replace only the old tiny mascot in the comment row with the pixel-art robot from Image 2, preserving its design.
Style/medium: production-ready raster UI mockup; crisp high-contrast sans-serif typography; subtle pixel accents only around the mascot; dark emerald SaaS dashboard; lime positive values; coral warnings; violet demo chip.
Composition/framing: portrait card, straight-on, symmetrical 24 px internal padding, consistent grid, no perspective, no rotation, no elements crossing the card boundary.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key outside the rounded card for local background removal; no shadow or glow outside the card.
Constraints: preserve exact text and numbers; one card only; no extra labels; no extra icons; no watermark; no mockup device frame; no stacked layers; no skew; no cropped content.
```

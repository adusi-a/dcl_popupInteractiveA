/**
 * @file craftingPopupModule.tsx
 * @module DN DCL Framework / ui / modules
 * @version 0.0001
 * @status NEEDS_TEST
 *
 * Recipe-based crafting window for DCL SDK7 React-ECS.
 * Opened by crafting station entities (Workbench, Smelter, etc.).
 *
 * Layout:
 *   Left panel (240px) — category tabs + scrollable recipe list
 *   Right panel (560px) — selected recipe: ingredient cards + output + CRAFT button
 *
 * Ingredient cards show:
 *   Item name / Need: ×N / Have: ×M / ✓ or ✗
 *   Card background: green-tinted if met, red-tinted if missing
 *
 * CRAFT button:
 *   Active (green)  — all ingredients available
 *   Disabled (gray) — missing one or more ingredients
 *   Single-click craft for now. Hold-to-craft (progress bar) is a future build.
 *
 * On craft: caller's onCraftItem callback handles consume + inventory + float + close.
 *
 * Usage (in uiMgr.tsx):
 *   CraftingPopupModule({ popupMgr, inventory })
 *
 * @changelog
 *   0.0001 - Initial. Built for dcl_popupInteractiveA crafting sprint.
 */

import ReactEcs, { Button, Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { PopupManager, Recipe } from '../popupManager'
import { PlayerInventory } from '../../player/playerInventory'

interface CraftingPopupModuleProps {
  popupMgr: PopupManager
  inventory: PlayerInventory
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const BG_OVERLAY    = Color4.create(0,    0,    0,    0.85)
const BG_WINDOW     = Color4.create(0.06, 0.08, 0.14, 0.97)
const BG_LEFT       = Color4.create(0.04, 0.05, 0.10, 0.95)
const BG_RIGHT      = Color4.create(0.07, 0.09, 0.15, 0.95)
const BG_TAB_ACTIVE = Color4.create(0.18, 0.38, 0.60, 1)
const BG_TAB_IDLE   = Color4.create(0.10, 0.13, 0.20, 1)
const BG_RECIPE_SEL = Color4.create(0.18, 0.30, 0.48, 1)
const BG_RECIPE_IDLE= Color4.create(0.10, 0.13, 0.20, 1)
const BG_ING_OK     = Color4.create(0.08, 0.22, 0.10, 1)
const BG_ING_MISS   = Color4.create(0.22, 0.07, 0.07, 1)
const BG_CRAFT_ON   = Color4.create(0.18, 0.48, 0.22, 1)
const BG_CRAFT_OFF  = Color4.create(0.18, 0.18, 0.20, 1)
const BG_CLOSE      = Color4.create(0.30, 0.12, 0.12, 1)
const CLR_HEADER    = Color4.create(0.95, 0.90, 0.70, 1)
const CLR_WHITE     = Color4.White()
const CLR_MUTED     = Color4.create(0.60, 0.60, 0.65, 1)
const CLR_OK        = Color4.create(0.40, 0.90, 0.45, 1)
const CLR_MISS      = Color4.create(0.95, 0.35, 0.35, 1)
const CLR_QTY_GOLD  = Color4.create(1,    0.85, 0.10, 1)

// ─── Main Component ───────────────────────────────────────────────────────────

export function CraftingPopupModule({ popupMgr, inventory }: CraftingPopupModuleProps) {
  if (popupMgr.popupType !== 'crafting') return null

  const recipes   = popupMgr.craftingRecipes
  const selected  = popupMgr.craftingSelectedRecipe
  const activeTab = popupMgr.craftingActiveCategory

  // Unique categories in recipe order
  const categories: string[] = []
  for (const r of recipes) {
    if (!categories.includes(r.category)) categories.push(r.category)
  }

  // Recipes for the active tab
  const visibleRecipes = recipes.filter(r => r.category === activeTab)

  // Can the selected recipe be crafted?
  const canCraft = selected != null && selected.ingredients.every(
    ing => inventory.hasEnough(ing.itemId, ing.quantity)
  )

  return (
    // Full-screen overlay
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: '100%', height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      uiBackground={{ color: BG_OVERLAY }}
    >
      {/* Outer window */}
      <UiEntity
        uiTransform={{
          width: 820, height: 520,
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
        uiBackground={{ color: BG_WINDOW }}
      >
        {/* Title bar */}
        <UiEntity
          uiTransform={{
            width: '100%', height: 46,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: { left: 18, right: 12 },
          }}
          uiBackground={{ color: Color4.create(0.08, 0.10, 0.18, 1) }}
        >
          <Label
            value={`⚒  ${popupMgr.craftingStationName.toUpperCase()}`}
            fontSize={20}
            color={CLR_HEADER}
          />
          <Button
            value="✕  Close (X)"
            fontSize={13}
            uiTransform={{ width: 110, height: 30 }}
            uiBackground={{ color: BG_CLOSE }}
            onMouseDown={() => popupMgr.closePopup()}
          />
        </UiEntity>

        {/* Body: left + right panels */}
        <UiEntity
          uiTransform={{
            width: '100%',
            height: 474,
            flexDirection: 'row',
          }}
        >
          {/* ── Left Panel — category tabs + recipe list ───────────────── */}
          <UiEntity
            uiTransform={{
              width: 240, height: '100%',
              flexDirection: 'column',
              alignItems: 'stretch',
              padding: { top: 10, left: 8, right: 8, bottom: 10 },
            }}
            uiBackground={{ color: BG_LEFT }}
          >
            {/* Category tabs */}
            {categories.length > 1 && (
              <UiEntity
                uiTransform={{
                  width: '100%',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  margin: { bottom: 8 },
                }}
              >
                {categories.map((cat, i) => (
                  <Button
                    key={i.toString()}
                    value={cat}
                    fontSize={13}
                    uiTransform={{
                      width: `${(224 / categories.length) - 4}px`,
                      height: 30,
                      margin: { right: 4, bottom: 4 },
                    }}
                    uiBackground={{ color: cat === activeTab ? BG_TAB_ACTIVE : BG_TAB_IDLE }}
                    onMouseDown={() => popupMgr.setCraftingCategory(cat)}
                  />
                ))}
              </UiEntity>
            )}

            {/* Recipe list */}
            {visibleRecipes.map((recipe, i) => {
              const isSel = selected?.id === recipe.id
              return (
                <Button
                  key={i.toString()}
                  value={recipe.name}
                  fontSize={14}
                  uiTransform={{
                    width: '100%',
                    height: 38,
                    margin: { bottom: 4 },
                  }}
                  uiBackground={{ color: isSel ? BG_RECIPE_SEL : BG_RECIPE_IDLE }}
                  onMouseDown={() => popupMgr.selectCraftingRecipe(recipe)}
                />
              )
            })}
          </UiEntity>

          {/* ── Right Panel — recipe detail ─────────────────────────────── */}
          <UiEntity
            uiTransform={{
              width: 580, height: '100%',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              padding: { top: 20, left: 24, right: 24, bottom: 16 },
            }}
            uiBackground={{ color: BG_RIGHT }}
          >
            {selected == null ? (
              <Label value="Select a recipe →" fontSize={16} color={CLR_MUTED} />
            ) : (
              <RecipeDetail
                recipe={selected}
                inventory={inventory}
                canCraft={canCraft}
                onCraft={() => popupMgr.doCraft()}
              />
            )}
          </UiEntity>
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

// ─── Recipe Detail ─────────────────────────────────────────────────────────────

interface RecipeDetailProps {
  recipe: Recipe
  inventory: PlayerInventory
  canCraft: boolean
  onCraft: () => void
}

function RecipeDetail({ recipe, inventory, canCraft, onCraft }: RecipeDetailProps) {
  return (
    <UiEntity
      uiTransform={{ width: '100%', flexDirection: 'column', alignItems: 'flex-start' }}
    >
      {/* Recipe name */}
      <Label
        value={recipe.name}
        fontSize={24}
        color={CLR_HEADER}
        uiTransform={{ margin: { bottom: 16 } }}
      />

      {/* "Ingredients:" label */}
      <Label
        value="Ingredients:"
        fontSize={14}
        color={CLR_MUTED}
        uiTransform={{ margin: { bottom: 10 } }}
      />

      {/* Ingredient cards — horizontal row */}
      <UiEntity
        uiTransform={{
          width: '100%',
          flexDirection: 'row',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          margin: { bottom: 20 },
        }}
      >
        {recipe.ingredients.map((ing, i) => {
          const have = inventory.getCount(ing.itemId)
          const met = have >= ing.quantity
          return (
            <UiEntity
              key={i.toString()}
              uiTransform={{
                width: 128,
                height: 90,
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                margin: { right: 10, bottom: 8 },
                padding: { top: 8, bottom: 8 },
              }}
              uiBackground={{ color: met ? BG_ING_OK : BG_ING_MISS }}
            >
              <Label value={ing.name}        fontSize={13} color={CLR_WHITE}                        textAlign="middle-center" />
              <Label value={`Need  ×${ing.quantity}`} fontSize={12} color={CLR_MUTED} uiTransform={{ margin: { top: 4 } }} textAlign="middle-center" />
              <Label value={`Have  ×${have}`} fontSize={12} color={CLR_QTY_GOLD} uiTransform={{ margin: { top: 2 } }} textAlign="middle-center" />
              <Label
                value={met ? '✓' : '✗'}
                fontSize={16}
                color={met ? CLR_OK : CLR_MISS}
                uiTransform={{ margin: { top: 4 } }}
                textAlign="middle-center"
              />
            </UiEntity>
          )
        })}
      </UiEntity>

      {/* Output */}
      <UiEntity
        uiTransform={{
          flexDirection: 'row',
          alignItems: 'center',
          margin: { bottom: 24 },
        }}
      >
        <Label value="Makes: " fontSize={14} color={CLR_MUTED} />
        <Label
          value={`${recipe.output.name}  ×${recipe.output.quantity}`}
          fontSize={16}
          color={CLR_WHITE}
        />
      </UiEntity>

      {/* Craft button */}
      <Button
        value={canCraft ? 'CRAFT' : 'Need resources'}
        fontSize={18}
        uiTransform={{ width: 200, height: 48 }}
        uiBackground={{ color: canCraft ? BG_CRAFT_ON : BG_CRAFT_OFF }}
        onMouseDown={() => { if (canCraft) onCraft() }}
      />
    </UiEntity>
  )
}

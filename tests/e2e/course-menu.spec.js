import { test, expect } from '@playwright/test';
import { seedAccount, readAccount } from './library-helpers.js';
import { createInitialState, STORAGE_KEY } from '../../public/domain.js';
import { applyCourseImport, normalizePayload } from '../../public/import-domain.js';

function stateWithCourse() {
  const payload = normalizePayload({
    title: 'Preparação Oab',
    provider: { id: 'grancursos' },
    sourceUrl: 'https://www.grancursosonline.com.br/aluno/curso/video/codigo/ABC',
    disciplines: [{ title: 'Direito', modules: [{ title: 'Aula 1', lessons: [{ title: 'Um' }, { title: 'Dois' }, { title: 'Três' }] }] }],
    extraction: { kind: 'extension-capture', confidence: 'medium', notes: [] },
    completeness: 'partial',
  });
  return { ...applyCourseImport({ ...createInitialState(), onboarded: true }, payload), onboarded: true };
}

// Menu "…" do cartão do curso: excluir com confirmação.

test('o menu "…" do cartão exclui o curso só depois da confirmação', { tag: '@celular' }, async ({ page }) => {
  const state = stateWithCourse();
  expect(state.courses.length).toBeGreaterThan(0);
  const target = state.courses[0];
  await seedAccount(page, state);
  await page.goto('/#biblioteca');
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();

  const menu = page.getByRole('button', { name: `Mais ações de ${target.title}` });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('menuitem', { name: 'Excluir curso' }).click();

  // Confirmação: nada some antes dela.
  await expect(page.getByRole('heading', { name: 'Excluir este curso?' })).toBeVisible();
  await page.getByRole('button', { name: 'Manter curso' }).click();
  await expect(menu).toBeVisible();

  await menu.click();
  await page.getByRole('menuitem', { name: 'Excluir curso' }).click();
  await page.getByRole('button', { name: 'Sim, excluir curso' }).click();
  await expect(page.getByRole('button', { name: `Mais ações de ${target.title}` })).toHaveCount(0);
  const left = (await readAccount(page)).courses.map((course) => course.id);
  expect(left).not.toContain(target.id);
  expect(left).toHaveLength(state.courses.length - 1);
});

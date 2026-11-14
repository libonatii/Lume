import { test, expect } from '@playwright/test';
import { seedAccount, readAccount } from './library-helpers.js';
import { addCourse, createInitialState, STORAGE_KEY } from '../../public/domain.js';

test('restaurar cópia mescla na conta sem persistência no navegador', async ({ page }) => {
  const current = addCourse(createInitialState(), { title: 'Curso atual', steps: ['Aula atual'] });
  current.onboarded = true;
  const incoming = addCourse(createInitialState(), { title: 'Curso da cópia', steps: ['Leitura da cópia'] });
  incoming.onboarded = true;

  await seedAccount(page, current);

  await page.goto('/#configuracoes');
  await page.getByRole('button', { name: 'Meus dados' }).click();
  await page.getByLabel('Escolher arquivo de cópia do Lume').setInputFiles({
    name: 'copia-lume.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(incoming)),
  });
  await expect(page.getByText(/Esta cópia acrescenta 1 material novo/)).toBeVisible();
  await expect(page.getByText('Curso da cópia')).toBeVisible();
  await page.getByRole('button', { name: 'Mesclar à minha biblioteca' }).click();
  await expect(page.getByText('Restauração enviada para gravação na conta.', { exact: true })).toBeVisible();

  const saved = await readAccount(page);
  expect(saved.courses.map((course) => course.title).sort()).toEqual(['Curso atual', 'Curso da cópia']);
  const previous = await page.evaluate((key) => localStorage.getItem(key), `${STORAGE_KEY}.before-import`);
  expect(previous).toBeNull();
});

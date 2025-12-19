import { test, expect } from "@playwright/test";
import { KanbanPage } from "../Page/KanbanPage";

test.describe("Kanban - Edit Card", () => {
  let kanban: KanbanPage;

  test.beforeEach(async ({ page }) => {
    kanban = new KanbanPage(page);
    await kanban.navigate();
  });

  test("should edit card to complete subtasks and move to first column", async ({
    page,
  }, testInfo) => {
    // Arrange: Find suitable card for editing
    const { cardName, originalColumn, firstColumn, originalSubtasks } =
      await test.step("Find card with incomplete subtasks not in first column", async () => {
        const board = await kanban.buildBoard();
        const { incompleteBoard } = kanban.splitByCompletion(board);

        const firstIncompleteColumn =
          kanban.findFirstNonEmptyColumn(incompleteBoard);
        if (!firstIncompleteColumn) {
          throw new Error("No incomplete cards found for editing");
        }

        const firstColumn = kanban.getFirstColumnName(board);

        // Ensure the card is not already in the first column
        if (firstIncompleteColumn.column === firstColumn) {
          throw new Error("Selected card is already in the first column");
        }

        const card = firstIncompleteColumn.cards[0];

        return {
          cardName: card.name,
          originalColumn: firstIncompleteColumn.column,
          firstColumn,
          originalSubtasks: card.subtasks,
        };
      });

    // Act: Complete subtasks
    await test.step("Open card and complete all subtasks", async () => {
      await kanban.openCard(cardName);
      await kanban.checkAllSubtasks(cardName);
    });

    // Act: Move to first column
    await test.step("Move card to first column", async () => {
      await kanban.moveToFirstStatus();
    });

    // Assert: Verify subtasks are struck through
    await test.step("Verify completed subtasks are struck through", async () => {
      await kanban.verifySubtasksStruckThrough();
    });

    // Act: Save changes
    await test.step("Save and close the card", async () => {
      await kanban.openCardMenu(cardName);
      await kanban.selectEditTask();
      await kanban.saveChanges();
    });

    // Assert: Verify subtasks count updated
    await test.step("Verify subtasks completion count is correct", async () => {
      await kanban.openCard(cardName);

      const updatedSubtasks = await kanban.getSubtasksInfo(cardName);

      expect(updatedSubtasks.total).toBe(originalSubtasks.total);
      expect(updatedSubtasks.completed).toBeGreaterThan(
        originalSubtasks.completed
      );
      expect(updatedSubtasks.completed).toBeLessThanOrEqual(
        updatedSubtasks.total
      );
    });

    // Assert: Verify card moved to correct column
    await test.step("Verify card moved to first column", async () => {
      const isInFirstColumn = await kanban.verifyCardInColumn(
        cardName,
        firstColumn
      );
      expect(isInFirstColumn).toBe(true);

      const isInOriginalColumn = await kanban.verifyCardInColumn(
        cardName,
        originalColumn
      );
      expect(isInOriginalColumn).toBe(false);
    });

    // Document: Capture final state
    await test.step("Attach final screenshot", async () => {
      const screenshot = await page.screenshot();
      await testInfo.attach("after-edit", {
        body: screenshot,
        contentType: "image/png",
      });
    });
  });
});

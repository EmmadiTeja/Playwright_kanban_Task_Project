import { test, expect } from "@playwright/test";
import { KanbanPage } from "../Page/KanbanPage";

test.describe("Kanban - Delete Card", () => {
  let kanban: KanbanPage;

  test.beforeEach(async ({ page }) => {
    kanban = new KanbanPage(page);
    await kanban.navigate();
  });

  test("should delete a card and update column count", async ({
    page,
  }, testInfo) => {
    // Arrange: Find a deletable card
    const { columnName, cardName, initialCount } =
      await test.step("Find deletable card and get initial count", async () => {
        const board = await kanban.buildBoard();
        const { incompleteBoard } = kanban.splitByCompletion(board);

        const firstIncompleteColumn =
          kanban.findFirstNonEmptyColumn(incompleteBoard);
        if (!firstIncompleteColumn) {
          throw new Error("No incomplete cards found for deletion");
        }

        const columnName = firstIncompleteColumn.column;
        const cardName = firstIncompleteColumn.cards[0].name;
        const initialCount = await kanban.getColumnCardCount(columnName);

        return { columnName, cardName, initialCount };
      });

    // Act: Complete subtasks and move card
    await test.step("Complete all subtasks and move to first status", async () => {
      await kanban.openCard(cardName);
      await kanban.checkAllSubtasks(cardName);
      await kanban.moveToFirstStatus();
      await kanban.verifySubtasksStruckThrough();
    });

    // Document: Capture state before deletion
    await test.step("Capture screenshot before deletion", async () => {
      const screenshot = await page.screenshot();
      await testInfo.attach("before-delete", {
        body: screenshot,
        contentType: "image/png",
      });
    });

    // Act: Delete the card
    await test.step("Delete the card", async () => {
      await kanban.openCardMenu(cardName);
      await kanban.selectDeleteTask();
      await kanban.confirmDelete();
    });

    // Assert: Verify card deletion
    await test.step("Verify card is deleted", async () => {
      await kanban.verifyCardNotPresent(cardName);
    });

    // Assert: Verify column count updated
    await test.step("Verify column count decreased by 1", async () => {
      const updatedCount = await kanban.getColumnCardCount(columnName);
      expect(updatedCount).toBe(initialCount - 1);
    });
  });
});

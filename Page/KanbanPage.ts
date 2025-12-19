import { Page, Locator, expect } from "@playwright/test";

export interface SubtaskInfo {
  completed: number;
  total: number;
  raw: string;
}

export interface Card {
  name: string;
  subtasks: SubtaskInfo;
}

export interface Board {
  [columnName: string]: Card[];
}

export interface ColumnInfo {
  column: string;
  cards: Card[];
  count: number;
}

export class KanbanPage {
  readonly page: Page;

  // Locators
  private readonly columnsContainer: Locator;
  private readonly columnHeader: Locator;
  private readonly cardArticles: Locator;
  private readonly cardTitle: Locator;
  private readonly cardSubtasksText: Locator;
  private readonly statusDropdown: Locator;
  private readonly statusOptions: Locator;
  private readonly completedSubtasksStrikethrough: Locator;
  private readonly editTaskOption: Locator;
  private readonly deleteTaskOption: Locator;
  private readonly deleteButton: Locator;
  private readonly cancelButton: Locator;
  private readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Container and structural locators
    this.columnsContainer = page.locator("div.flex.gap-6 > section");
    this.columnHeader = page.locator("h2");
    this.cardArticles = page.locator("article");
    this.cardTitle = page.locator("h3");
    this.cardSubtasksText = page.locator("p.text-xs");

    // Status dropdown locators
    this.statusDropdown = page.locator(
      "//p[text()=' Current Status ']/following-sibling::div"
    );
    this.statusOptions = page.locator(
      "(//div[contains(@class,'p-4 text-medium-grey')])"
    );

    // Subtask locators
    this.completedSubtasksStrikethrough = page.locator(
      "div.flex.flex-col.gap-2 label span.line-through"
    );

    // Menu action locators
    this.editTaskOption = page.locator(
      '//p[normalize-space(text())="Edit Task"]'
    );
    this.deleteTaskOption = page.locator(
      '//p[normalize-space(text())="Delete Task"]'
    );

    // Button locators
    this.deleteButton = page.locator('//button[text()="Delete"]');
    this.cancelButton = page.locator(
      '//button[normalize-space(text())="Cancel"]'
    );
    this.submitButton = page.locator("//button[@type='submit']");
  }

  // Navigation
  async navigate(): Promise<void> {
    await this.page.goto("https://kanban-566d8.firebaseapp.com/");
  }

  // Board Data Methods
  async buildBoard(): Promise<Board> {
    const board: Board = {};
    const columnCount = await this.columnsContainer.count();

    for (let i = 0; i < columnCount; i++) {
      const columnName = await this.getColumnName(i);
      const cards = await this.getCardsInColumn(i);
      board[columnName] = cards;
    }

    return board;
  }

  private async getColumnName(columnIndex: number): Promise<string> {
    const section = this.columnsContainer.nth(columnIndex);
    const headerText = await section.locator(this.columnHeader).innerText();
    return headerText.split("(")[0].trim();
  }

  private async getCardsInColumn(columnIndex: number): Promise<Card[]> {
    const section = this.columnsContainer.nth(columnIndex);
    const cardsLocator = section.locator(this.cardArticles);
    const cardCount = await cardsLocator.count();
    const cards: Card[] = [];

    for (let j = 0; j < cardCount; j++) {
      const card = await this.getCardData(cardsLocator.nth(j));
      cards.push(card);
    }

    return cards;
  }

  private async getCardData(cardLocator: Locator): Promise<Card> {
    const name = await cardLocator.locator(this.cardTitle).innerText();
    const subtasksText = await cardLocator
      .locator(this.cardSubtasksText)
      .innerText();

    return {
      name: name.trim(),
      subtasks: this.parseSubtasks(subtasksText),
    };
  }

  private parseSubtasks(text: string): SubtaskInfo {
    const parts = text.trim().split(" ");
    return {
      completed: Number(parts[0]),
      total: Number(parts[2]),
      raw: text.trim(),
    };
  }

  splitByCompletion(board: Board): {
    completedBoard: Board;
    incompleteBoard: Board;
  } {
    const completedBoard: Board = {};
    const incompleteBoard: Board = {};

    for (const [columnName, cards] of Object.entries(board)) {
      completedBoard[columnName] = cards.filter(
        (card) => card.subtasks.completed === card.subtasks.total
      );
      incompleteBoard[columnName] = cards.filter(
        (card) => card.subtasks.completed !== card.subtasks.total
      );
    }

    return { completedBoard, incompleteBoard };
  }

  findFirstNonEmptyColumn(board: Board): ColumnInfo | null {
    const columnNames = Object.keys(board);

    // Start from index 1 to skip the first column
    for (let i = 1; i < columnNames.length; i++) {
      const columnName = columnNames[i];
      const cards = board[columnName];

      if (cards.length > 0) {
        return {
          column: columnName,
          cards,
          count: cards.length,
        };
      }
    }

    return null;
  }

  getFirstColumnName(board: Board): string {
    return Object.keys(board)[0];
  }

  // Card Interaction Methods
  async openCard(cardName: string): Promise<void> {
    const cardLocator = this.getCardLocator(cardName);
    await cardLocator.click();
  }

  async checkAllSubtasks(cardName: string): Promise<void> {
    const checkboxes = this.getSubtaskCheckboxes(cardName);
    const count = await checkboxes.count();

    for (let i = 0; i < count; i++) {
      await this.checkSubtaskIfUnchecked(checkboxes.nth(i));
    }
  }

  private async checkSubtaskIfUnchecked(checkbox: Locator): Promise<void> {
    const isChecked = await checkbox.isChecked();
    if (!isChecked) {
      await checkbox.locator("xpath=ancestor::label").click();
    }
  }

  async moveToFirstStatus(): Promise<void> {
    await this.openStatusDropdown();
    await this.selectFirstStatusOption();
  }

  private async openStatusDropdown(): Promise<void> {
    await this.statusDropdown.click();
  }

  private async selectFirstStatusOption(): Promise<void> {
    await this.statusOptions.first().click();
  }

  async openCardMenu(cardName: string): Promise<void> {
    const menuButton = this.getCardMenuButton(cardName);
    await menuButton.click();
  }

  async selectEditTask(): Promise<void> {
    await this.editTaskOption.click();
  }

  async selectDeleteTask(): Promise<void> {
    await this.deleteTaskOption.click();
  }

  async confirmDelete(): Promise<void> {
    await this.deleteButton.click();
  }

  async cancelDelete(): Promise<void> {
    await this.cancelButton.click();
  }

  async saveChanges(): Promise<void> {
    await this.submitButton.click();
  }

  // Verification Methods
  async verifySubtasksStruckThrough(): Promise<void> {
    const count = await this.completedSubtasksStrikethrough.count();

    for (let i = 0; i < count; i++) {
      await expect(this.completedSubtasksStrikethrough.nth(i)).toHaveClass(
        /line-through/
      );
    }
  }

  async verifyCardNotPresent(cardName: string): Promise<void> {
    const cardLocator = this.getCardLocator(cardName);
    await expect(cardLocator).toHaveCount(0);
  }

  async verifyCardInColumn(
    cardName: string,
    columnName: string
  ): Promise<boolean> {
    const board = await this.buildBoard();
    const columnCards = board[columnName] ?? [];
    return columnCards.some((card) => card.name === cardName);
  }

  async verifyCardNotInColumn(
    cardName: string,
    columnName: string
  ): Promise<boolean> {
    const board = await this.buildBoard();
    const columnCards = board[columnName] ?? [];
    return !columnCards.some((card) => card.name === cardName);
  }

  async getColumnCardCount(columnName: string): Promise<number> {
    const column = this.columnsContainer.filter({ hasText: columnName });
    return await column.locator(this.cardArticles).count();
  }

  async getSubtasksInfo(
    cardName: string
  ): Promise<{ completed: number; total: number }> {
    const subtasksText = await this.page
      .locator(
        `//h4[normalize-space(text())='${cardName}']/following::p[contains(normalize-space(.), 'Subtasks')]`
      )
      .first()
      .innerText();

    const parts = subtasksText.split(/\D+/g).filter(Boolean);
    return {
      completed: Number(parts[0]),
      total: Number(parts[1]),
    };
  }

  // Private Helper Methods - Dynamic Locators
  private getCardLocator(cardName: string): Locator {
    return this.page.locator(`//h3[normalize-space(text())='${cardName}']`);
  }

  private getCardMenuButton(cardName: string): Locator {
    return this.page.locator(
      `//h4[normalize-space(text())='${cardName}']/following-sibling::div`
    );
  }

  private getSubtaskCheckboxes(cardName: string): Locator {
    return this.page.locator(
      `//h4[normalize-space(text())='${cardName}']/following::label//input[@type='checkbox']`
    );
  }
}

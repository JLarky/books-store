import { getBookImage, listBooksForOwner } from "./books.ts";
import { listCategoriesForOwner } from "./categories.ts";

export type BooksBackupBook = {
  id: string;
  description: string;
  categoryIds: string[];
  contentType: string;
  twoCopies: boolean;
  createdAt: string;
  receivedAt: string | null;
  imageBase64: string;
};

export type BooksBackupCategory = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
};

export type BooksBackup = {
  version: 1;
  exportedAt: string;
  categories: BooksBackupCategory[];
  books: BooksBackupBook[];
};

export async function buildOwnerBackup(ownerId: string): Promise<BooksBackup> {
  const [categories, books] = await Promise.all([
    listCategoriesForOwner(ownerId),
    listBooksForOwner(ownerId),
  ]);

  const backupBooks: BooksBackupBook[] = [];
  for (const book of books) {
    const image = await getBookImage(book.id);
    backupBooks.push({
      id: book.id,
      description: book.description,
      categoryIds: [...book.categoryIds],
      contentType: book.contentType,
      twoCopies: book.twoCopies,
      createdAt: book.createdAt,
      receivedAt: book.receivedAt,
      imageBase64: image ? Buffer.from(image.bytes).toString("base64") : "",
    });
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      createdAt: category.createdAt,
    })),
    books: backupBooks,
  };
}

export function backupJson(backup: BooksBackup): string {
  return JSON.stringify(backup, null, 2);
}

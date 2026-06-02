import prisma from '../config/db.js';

/**
 * Checks if an inventory item is below its low-stock threshold
 * and automatically creates a restock task if needed.
 */
export const checkAndCreateRestockTask = async (
  userId: string,
  itemId: string,
  itemName: string,
  newQuantity: number,
  lowThreshold: number,
): Promise<void> => {
  if (newQuantity > lowThreshold) return;

  // Check if a pending restock task already exists for this item
  const existingTask = await prisma.task.findFirst({
    where: {
      userId,
      category: 'inventory',
      title: { contains: itemName },
      status: { in: ['pending', 'in_progress'] },
    },
  });

  if (existingTask) return; // Don't duplicate

  await prisma.task.create({
    data: {
      userId,
      title: `Restock: ${itemName}`,
      description: `${itemName} is running low (${newQuantity} remaining, threshold: ${lowThreshold}). Please reorder supplies.`,
      status: 'pending',
      priority: newQuantity === 0 ? 'high' : 'medium',
      category: 'inventory',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    },
  });
};

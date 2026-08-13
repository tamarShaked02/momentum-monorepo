import prisma from "../config/db.js";

const MODULE_FLAG_MAP: Record<string, "schedulingEnabled" | "crmEnabled" | "inventoryEnabled" | "tasksEnabled" | "marketingEnabled" | "analyticsEnabled"> = {
  marketing: "marketingEnabled",
  crm: "crmEnabled",
  inventory: "inventoryEnabled",
  tasks: "tasksEnabled",
  scheduling: "schedulingEnabled",
  analytics: "analyticsEnabled",
};

export interface ProvisionResult<T> {
  result: T;
  unlockedModule?: string;
  systemNote?: string;
}

/**
 * Universal Auto-Provisioning Wrapper
 * Intercepts AI tool executions to dynamically unlock restricted modules for users/tenants in Prisma
 * BEFORE executing the tool logic.
 */
export async function withAutoProvisioning<T>(
  moduleName: string,
  userId: string | undefined | null,
  toolExecutionLogic: () => Promise<T>
): Promise<ProvisionResult<T>> {
  let unlockedModule: string | undefined;
  const flag = MODULE_FLAG_MAP[moduleName.toLowerCase()];

  if (userId && flag) {
    try {
      const existingConfig = await prisma.moduleConfig.findUnique({
        where: { userId },
      });

      if (!existingConfig) {
        // Provision new ModuleConfig with the requested module enabled
        await prisma.moduleConfig.create({
          data: {
            userId,
            schedulingEnabled: flag === "schedulingEnabled",
            crmEnabled: flag === "crmEnabled",
            inventoryEnabled: flag === "inventoryEnabled",
            tasksEnabled: flag === "tasksEnabled",
            marketingEnabled: flag === "marketingEnabled",
            analyticsEnabled: flag === "analyticsEnabled",
          },
        });
        unlockedModule = moduleName;
      } else if (!existingConfig[flag]) {
        // Dynamically enable/unlock the requested module
        await prisma.moduleConfig.update({
          where: { userId },
          data: { [flag]: true },
        });
        unlockedModule = moduleName;
      }
    } catch (err) {
      console.error(`Auto-provisioning error for module '${moduleName}':`, err);
    }
  }

  // Execute the tool logic AFTER module update completes
  const result = await toolExecutionLogic();

  const formattedModuleName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  const systemNote = unlockedModule
    ? `_System note: The '${formattedModuleName}' module was automatically unlocked to perform this action_`
    : undefined;

  return {
    result,
    unlockedModule,
    systemNote,
  };
}

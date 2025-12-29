/**
 * Template Utilities
 *
 * Helper functions for template processing, including variable substitution.
 */

/**
 * Substitute variables in template content
 *
 * Replaces placeholders like {firstName}, {lastName}, {companyName}
 * with actual values.
 */
export function substituteTemplateVariables(
  content: string,
  variables: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    email?: string;
  }
): string {
  let result = content;

  // Replace each variable if provided
  if (variables.firstName) {
    result = result.replace(/{firstName}/g, variables.firstName);
  }

  if (variables.lastName) {
    result = result.replace(/{lastName}/g, variables.lastName);
  }

  if (variables.companyName) {
    result = result.replace(/{companyName}/g, variables.companyName);
  }

  if (variables.email) {
    result = result.replace(/{email}/g, variables.email);
  }

  return result;
}

/**
 * Get list of available template variables
 *
 * Returns all supported variables for frontend display.
 */
export function getAvailableTemplateVariables(): Array<{
  key: string;
  label: string;
  example: string;
}> {
  return [
    {
      key: "{firstName}",
      label: "Customer First Name",
      example: "John",
    },
    {
      key: "{lastName}",
      label: "Customer Last Name",
      example: "Smith",
    },
    {
      key: "{companyName}",
      label: "Company Name",
      example: "Acme Inc",
    },
    {
      key: "{email}",
      label: "Customer Email",
      example: "john@example.com",
    },
  ];
}

/**
 * Extract variable placeholders from template content
 *
 * Returns list of variables found in the template.
 */
export function extractTemplateVariables(content: string): string[] {
  const regex = /{(\w+)}/g;
  const matches = content.matchAll(regex);
  const variables = new Set<string>();

  for (const match of matches) {
    variables.add(`{${match[1]}}`);
  }

  return Array.from(variables);
}

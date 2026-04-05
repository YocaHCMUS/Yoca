# Spec-Driven Development (SDD) Style Guide

## 1. Core Philosophy
Code is an implementation of a **Specification**. Every function, route, and utility must be self-describing, modular, and strictly organized. If the logic cannot be explained in a few simple steps, it must be refactored.

---

## 2. Naming Conventions
Consistency in naming allows for immediate recognition of data types and logic.

| Entity | Convention | Example |
| :--- | :--- | :--- |
| **Functions & Routes** | `camelCase` | `calculateUserTax()` |
| **Constants** | `UPPER_SNAKE_CASE` | `RETRY_LIMIT_MAX` |
| **Files/Directories** | `kebab-case` | `auth-service.js`, `authenticator.service.js` |
| **Classes** | `PascalCase` | `PaymentProcessor` |

---

## 3. Documentation Standards
Every public function or API route **must** include a header comment acting as its technical specification.

* **Purpose:** A brief, clear description of the business logic.
* **Usage Example:** A code snippet or JSON block showing expected input/output.

> **Note:** Constants that are not self-explanatory must be documented with a comment explaining their origin or unit of measurement (e.g., `ms`, `px`).

---

## 4. Function Architecture (The 8-Step Rule)
To maintain readability and ease of testing, functions must focus on the "Happy Path":

1. **Step Limit:** 5 to 8 logical steps maximum.
2. **Error Handling:** Validation and error catching must be performed by **modular utility functions** before the data reaches the main logic.
3. **Abstraction:** If the happy path exceeds 8 steps, move sub-processes into a dedicated implementation file within the sub-category.

---

## 5. Directory Structure
Projects follow a **Category-First** hierarchy to separate technical concerns from business domains.

**Pattern:** `/src/[category]/[sub-category]/[implementation]`  
*Or:* `/src/[category]/[sub-category]/[sub-sub-category]/[implementation]`

**Example Hierarchy:**
```text
/src
 └── /services
     └── /billing
         ├── tax-calculator.js
         └── tax-calculator.test.js  <-- Mandatory 1:1 Testing
 └── /routes
     └── /auth
         ├── login-handler.js
         └── login-handler.test.js
 └── /db
     └── /connection
         ├── postgres-client.js
         └── postgres-client.test.js
```
## 6. Development Rules
    Single Responsibility: A file must only contain functions of the same purpose.

    Zero Redundancy (DRY): If logic is repeated in more than two places, it must be moved to a util category.

    No Magic Values: Hardcoded numbers or strings are strictly forbidden. Use named constants.

    Mandated Testing: Every service, function, or utility file must have a dedicated unit test file in the same directory.

## 7. Implementation Template
```JavaScript
/**
 * PURPOSE: Validates and applies a discount code to a cart total.
 * USAGE: 
 * const finalPrice = applyDiscount(100, 'SUMMER24');
 * // Output: 85
 */

const DISCOUNT_EXPIRY_DAYS = 30; // Standard promotional window

export const applyDiscount = (amount, code) => {
  // Step 1: Fetch discount metadata from modular util
  // Step 2: Verify code validity
  // Step 3: Calculate percentage reduction
  // Step 4: Apply cap to maximum discount
  // Step 5: Return rounded total
  return finalAmount;
};
```
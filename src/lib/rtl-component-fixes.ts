/**
 * RTL-specific fixes for common UI components
 */
import { isRTL } from './rtl-utils';

/**
 * Fixes RTL issues in dropdown menus
 * @param element The dropdown menu element
 */
export const fixRTLDropdown = (element: HTMLElement): void => {
  if (!isRTL() || !element) return;
  
  // Fix dropdown positioning
  element.style.transformOrigin = 'top right';
  
  // Fix dropdown content alignment
  const items = element.querySelectorAll('[role="menuitem"]');
  items.forEach(item => {
    if (item instanceof HTMLElement) {
      item.style.textAlign = 'right';
      
      // Fix icon alignment in dropdown items
      const icons = item.querySelectorAll('svg');
      icons.forEach(icon => {
        if (icon.parentElement) {
          // Swap icon order in flex containers
          if (window.getComputedStyle(icon.parentElement).display === 'flex') {
            icon.parentElement.style.flexDirection = 'row-reverse';
          }
        }
      });
    }
  });
};

/**
 * Fixes RTL issues in dialog components
 * @param element The dialog element
 */
export const fixRTLDialog = (element: HTMLElement): void => {
  if (!isRTL() || !element) return;
  
  // Fix dialog content alignment
  const dialogContent = element.querySelector('[role="dialog"]');
  if (dialogContent instanceof HTMLElement) {
    dialogContent.style.textAlign = 'right';
    
    // Fix dialog header
    const dialogHeader = dialogContent.querySelector('header');
    if (dialogHeader instanceof HTMLElement) {
      dialogHeader.style.textAlign = 'right';
    }
    
    // Fix form elements inside dialog
    const formElements = dialogContent.querySelectorAll('input, textarea, select');
    formElements.forEach(element => {
      if (element instanceof HTMLElement) {
        element.style.textAlign = 'right';
      }
    });
    
    // Fix button alignment in dialog footer
    const dialogFooter = dialogContent.querySelector('footer');
    if (dialogFooter instanceof HTMLElement) {
      // If footer has flex layout, reverse it
      if (window.getComputedStyle(dialogFooter).display === 'flex') {
        dialogFooter.style.flexDirection = 'row-reverse';
      }
    }
  }
};

/**
 * Fixes RTL issues in form components
 * @param element The form element
 */
export const fixRTLForm = (element: HTMLElement): void => {
  if (!isRTL() || !element) return;
  
  // Fix form layout
  element.style.textAlign = 'right';
  
  // Fix form labels
  const labels = element.querySelectorAll('label');
  labels.forEach(label => {
    if (label instanceof HTMLElement) {
      label.style.textAlign = 'right';
      
      // If label has flex layout, reverse it
      if (window.getComputedStyle(label).display === 'flex') {
        label.style.flexDirection = 'row-reverse';
      }
    }
  });
  
  // Fix form inputs
  const inputs = element.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    if (input instanceof HTMLElement) {
      input.style.textAlign = 'right';
      
      // Fix placeholder text alignment
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
        input.style.direction = 'rtl';
      }
    }
  });
  
  // Fix checkbox and radio button alignment
  const checkboxes = element.querySelectorAll('input[type="checkbox"], input[type="radio"]');
  checkboxes.forEach(checkbox => {
    if (checkbox.parentElement) {
      // If parent has flex layout, reverse it
      if (window.getComputedStyle(checkbox.parentElement).display === 'flex') {
        checkbox.parentElement.style.flexDirection = 'row-reverse';
      }
    }
  });
};

/**
 * Fixes RTL issues in table components
 * @param element The table element
 */
export const fixRTLTable = (element: HTMLElement): void => {
  if (!isRTL() || !element) return;
  
  // Fix table layout
  element.style.direction = 'rtl';
  
  // Fix table headers
  const headers = element.querySelectorAll('th');
  headers.forEach(header => {
    if (header instanceof HTMLElement) {
      header.style.textAlign = 'right';
    }
  });
  
  // Fix table cells
  const cells = element.querySelectorAll('td');
  cells.forEach(cell => {
    if (cell instanceof HTMLElement) {
      cell.style.textAlign = 'right';
    }
  });
};

/**
 * Fixes RTL issues in card components
 * @param element The card element
 */
export const fixRTLCard = (element: HTMLElement): void => {
  if (!isRTL() || !element) return;
  
  // Fix card content alignment
  element.style.textAlign = 'right';
  
  // Fix card header
  const cardHeader = element.querySelector('header');
  if (cardHeader instanceof HTMLElement) {
    cardHeader.style.textAlign = 'right';
    
    // If header has flex layout, reverse it
    if (window.getComputedStyle(cardHeader).display === 'flex') {
      cardHeader.style.flexDirection = 'row-reverse';
    }
  }
  
  // Fix card footer
  const cardFooter = element.querySelector('footer');
  if (cardFooter instanceof HTMLElement) {
    // If footer has flex layout, reverse it
    if (window.getComputedStyle(cardFooter).display === 'flex') {
      cardFooter.style.flexDirection = 'row-reverse';
    }
  }
};

/**
 * Fixes RTL issues in navigation components
 * @param element The navigation element
 */
export const fixRTLNavigation = (element: HTMLElement): void => {
  if (!isRTL() || !element) return;
  
  // Fix navigation layout
  element.style.direction = 'rtl';
  
  // Fix navigation items
  const navItems = element.querySelectorAll('a, button');
  navItems.forEach(item => {
    if (item instanceof HTMLElement) {
      // If item has flex layout, reverse it
      if (window.getComputedStyle(item).display === 'flex') {
        item.style.flexDirection = 'row-reverse';
      }
      
      // Fix icon alignment in navigation items
      const icons = item.querySelectorAll('svg');
      icons.forEach(icon => {
        if (icon.parentElement) {
          // Swap icon order in flex containers
          if (window.getComputedStyle(icon.parentElement).display === 'flex') {
            icon.parentElement.style.flexDirection = 'row-reverse';
          }
        }
      });
    }
  });
};

/**
 * Applies all RTL fixes to a component based on its role or type
 * @param element The element to fix
 */
export const applyRTLComponentFixes = (element: HTMLElement): void => {
  if (!isRTL() || !element) return;
  
  // Determine element type and apply appropriate fixes
  const role = element.getAttribute('role');
  const tagName = element.tagName.toLowerCase();
  
  if (role === 'menu' || role === 'menubar') {
    fixRTLDropdown(element);
  } else if (role === 'dialog') {
    fixRTLDialog(element);
  } else if (tagName === 'form' || element.classList.contains('form')) {
    fixRTLForm(element);
  } else if (tagName === 'table' || element.classList.contains('table')) {
    fixRTLTable(element);
  } else if (element.classList.contains('card')) {
    fixRTLCard(element);
  } else if (tagName === 'nav' || element.classList.contains('nav')) {
    fixRTLNavigation(element);
  }
  
  // Apply fixes to children recursively
  Array.from(element.children).forEach(child => {
    if (child instanceof HTMLElement) {
      applyRTLComponentFixes(child);
    }
  });
};

export default {
  fixRTLDropdown,
  fixRTLDialog,
  fixRTLForm,
  fixRTLTable,
  fixRTLCard,
  fixRTLNavigation,
  applyRTLComponentFixes
};
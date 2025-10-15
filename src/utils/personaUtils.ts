import { PersonaType } from "../components/PersonaSelector";

// Type for persona display names
export type PersonaDisplayName =
  | "GreenBot"
  | "EcoLife Guide"
  | "Waste Wizard"
  | "Nature Navigator"
  | "Power Sage"
  | "Climate Guardian";

/**
 * Convert a persona type to its display name
 */
export function getPersonaDisplayName(
  persona: PersonaType,
): PersonaDisplayName {
  switch (persona) {
    case "greenbot":
      return "GreenBot";
    case "lifestyle":
      return "EcoLife Guide";
    case "waste":
      return "Waste Wizard";
    case "nature":
      return "Nature Navigator";
    case "energy":
      return "Power Sage";
    case "climate":
      return "Climate Guardian";
    default:
      return "GreenBot";
  }
}

/**
 * Get a welcome message for the given persona
 */
export function getPersonaWelcomeMessage(persona: PersonaType): string {
  switch (persona) {
    case "greenbot":
      return "I'm GreenBot, your general sustainability advisor. How can I help you with environmental topics today?";
    case "lifestyle":
      return "I'm your EcoLife Guide, specializing in sustainable lifestyle choices. How can I help you live more eco-consciously?";
    case "waste":
      return "I'm your Waste Wizard, focused on waste reduction and proper recycling practices. What would you like to know about managing waste more effectively?";
    case "nature":
      return "I'm your Nature Navigator, dedicated to biodiversity and conservation. How can I help you connect with and protect natural ecosystems?";
    case "energy":
      return "I'm your Power Sage, specializing in energy efficiency and renewable solutions. How can I help you optimize your energy usage?";
    case "climate":
      return "I'm your Climate Guardian, focused on climate action and resilience. How can I help you understand and address climate challenges?";
    default:
      return "How can I assist you with sustainability topics today?";
  }
}

/**
 * Get the quiz title for the given persona
 */
export function getQuizTitle(persona: PersonaType): string {
  switch (persona) {
    case "greenbot":
      return "General Sustainability Quiz";
    case "lifestyle":
      return "Eco-Lifestyle Quiz";
    case "waste":
      return "Waste Management Quiz";
    case "nature":
      return "Biodiversity Quiz";
    case "energy":
      return "Energy Efficiency Quiz";
    case "climate":
      return "Climate Action Quiz";
    default:
      return "Environmental Quiz";
  }
}

export type SheetAttrKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type CharacterAttributes = Record<SheetAttrKey, number>;

export type SheetProficiency = {
  id: string;
  attribute: SheetAttrKey;
  name: string;
  proficient: boolean;
};

export type SheetSkill = {
  id: string;
  name: string;
  usesPer?: string;
  usedCount?: number;
  description?: string;
};

export type SheetInventoryItem = {
  id: string;
  name: string;
  quantity: number;
};

export type SheetInventoryCategory = {
  id: string;
  name: string;
  items: SheetInventoryItem[];
};

export type CharacterSheet = {
  portraitUrl: string;

  characterName: string;
  level: number;
  className: string;
  experience: number;
  currency: number;
  maxHp: number;
currentHp: number;
proficiencyBonus: number;


  attributes: CharacterAttributes;

  proficiencies: SheetProficiency[];
  skills: SheetSkill[];

  inventoryCategories: SheetInventoryCategory[];

  updatedAt?: any;
};

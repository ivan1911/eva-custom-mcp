import { EvaTeamClient } from "./index.js";
import type { Person } from "../types/person.js";

const PERSON_FIELDS = ["id", "code", "name", "login"];
const PERSON_REF_PREFIX = "CmfPerson:";

export class EvaPersonClient {
  private currentUser?: Person;

  constructor(
    private client: EvaTeamClient,
    private userLogin?: string,
  ) {}

  async search(query: string, limit = 20): Promise<Person[]> {
    return this.client.rpc<Person[]>("CmfPerson.list", {
      kwargs: {
        filter: [
          ["system", "==", false],
          ["OR", ["name", "ILIKE", `%${query}%`], ["login", "ILIKE", `%${query}%`]],
        ],
        fields: PERSON_FIELDS,
        slice: [0, limit],
        order_by: ["name"],
      },
    });
  }

  async getByLogin(login: string): Promise<Person | null> {
    return this.client.rpc<Person | null>("CmfPerson.get", {
      kwargs: { filter: ["login", "==", login], fields: PERSON_FIELDS },
    });
  }

  async getByRef(personRef: string): Promise<Person | null> {
    return this.client.rpc<Person | null>("CmfPerson.get", {
      args: [personRef],
      kwargs: { fields: PERSON_FIELDS },
    });
  }

  // Accepts a CmfPerson reference, an exact login, or a unique part of a name/login.
  async resolve(person: string): Promise<Person> {
    const value = person.trim();
    if (!value) throw new Error("Person is required");

    if (value.startsWith(PERSON_REF_PREFIX)) {
      const found = await this.getByRef(value);
      if (!found) throw new Error(`Person not found: ${value}`);
      return found;
    }

    const byLogin = await this.getByLogin(value);
    if (byLogin) return byLogin;

    const matches = await this.search(value, 10);
    if (matches.length === 1) return matches[0] as Person;
    if (matches.length === 0) throw new Error(`Person not found: ${value}`);
    const candidates = matches.map((match) => `${match.name ?? "?"} (${match.login ?? match.code ?? match.id})`);
    throw new Error(`Several people match "${value}": ${candidates.join(", ")}. Pass a login instead.`);
  }

  // Resolves to an object reference without a lookup when one is passed already.
  async resolveRef(person: string): Promise<{ id: string }> {
    const value = person.trim();
    if (value.startsWith(PERSON_REF_PREFIX)) return { id: value };
    return { id: (await this.resolve(value)).id };
  }

  async getCurrentUser(): Promise<Person> {
    if (this.currentUser) return this.currentUser;

    if (this.userLogin) {
      const person = await this.getByLogin(this.userLogin);
      if (!person) throw new Error(`EVA_USER_LOGIN user not found: ${this.userLogin}`);
      this.currentUser = person;
      return person;
    }

    let person: Person | null = null;
    try {
      person = await this.client.rpc<Person | null>("CmfPerson.public_get_current_user");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not determine the current user (${reason}). Set EVA_USER_LOGIN to your EvaTeam login.`);
    }
    if (!person?.id) {
      throw new Error("Could not determine the current user. Set EVA_USER_LOGIN to your EvaTeam login.");
    }

    this.currentUser = { id: person.id, code: person.code, name: person.name, login: person.login };
    return this.currentUser;
  }
}

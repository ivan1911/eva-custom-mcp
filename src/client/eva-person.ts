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

    const login = this.userLogin?.trim();
    if (!login) throw new Error("Set EVA_USER_LOGIN to your EvaTeam login to use whoami or my_tasks without person.");

    const person = await this.getByLogin(login);
    if (!person?.id) throw new Error(`EVA_USER_LOGIN user not found: ${login}`);
    this.currentUser = person;
    return this.currentUser;
  }
}

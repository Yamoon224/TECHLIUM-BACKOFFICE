import { PAGE_SIZES } from "@/lib/datatable";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppearanceProvider } from "./AppearanceProvider";
import { DataTable } from "./DataTable";

interface Row {
  id: number;
  name: string;
}

const rows: Row[] = Array.from({ length: 25 }, (_, index) => ({ id: index + 1, name: `Ligne ${index + 1}` }));

function render(props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}): string {
  return renderToStaticMarkup(
    <AppearanceProvider>
      <DataTable<Row>
        name="essai"
        rows={rows}
        headers={["Numéro", "Nom", "Action"]}
        actionColumns={[2]}
        renderRow={(row) => (
          <tr key={row.id}>
            <td>{row.id}</td>
            <td>{row.name}</td>
            <td>
              <button type="button">Ouvrir</button>
            </td>
          </tr>
        )}
        {...props}
      />
    </AppearanceProvider>,
  );
}

describe("DataTable", () => {
  it("shows ten rows by default and the pager, with the item count out of the total", () => {
    const html = render();

    expect(html.match(/<td>Ligne /g)).toHaveLength(10);
    expect(html).toContain("Ligne 10");
    expect(html).not.toContain("Ligne 11<");
    expect(html).toContain(">1/3<");
    expect(html).toContain("Éléments affichés");
    expect(html).toMatch(/>10<\/span> \/ <span[^>]*>25</);
  });

  it("offers the page sizes 10, 20, 30, 50, 100 and All", () => {
    // The sizes live in a searchable list that is closed on first render: it shows the current one.
    expect(PAGE_SIZES).toEqual([10, 20, 30, 50, 100, "all"]);
    expect(render()).toMatch(/role="combobox"[^>]*>[^]*?<span[^>]*>10<\/span>/);
  });

  it("has Previous disabled on the first page and Next enabled", () => {
    const html = render();

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^]*?Précédent/);
    expect(html).not.toMatch(/disabled=""[^>]*>[^<]*(<svg[^>]*>[^]*?<\/svg>)? ?Suivant/);
  });

  it("has a coloured header with a sort button on every data column but not on the action column", () => {
    const html = render();

    expect(html).toContain("bg-gold");
    expect(html).toContain("text-on-primary");
    expect(html.match(/<th /g)).toHaveLength(3);
    // Two sortable columns: two buttons inside the header, each with the neutral sort icon.
    const head = html.slice(html.indexOf("<thead"), html.indexOf("</thead>"));
    expect(head.match(/<button/g)).toHaveLength(2);
    expect(head).toContain('aria-sort="none"');
  });

  it("has the five export buttons", () => {
    const html = render();

    for (const label of ["PDF", "Excel", "CSV", "TXT", "SQL"]) expect(html).toContain(`>${label}</button>`);
  });

  it("disables the exports for an empty table and says so", () => {
    const html = render({ rows: [] });

    expect(html).toContain("Aucune donnée.");
    expect(html.match(/<button[^>]*disabled=""[^>]*>(PDF|Excel|CSV|TXT|SQL)</g)).toHaveLength(5);
    expect(html).toContain(">1/1<");
  });

  it("renders a footer outside the paged rows", () => {
    const html = render({ footer: <tr><td>TOTAL-ROW</td></tr> });

    expect(html).toContain("<tfoot");
    expect(html).toContain("TOTAL-ROW");
  });
});

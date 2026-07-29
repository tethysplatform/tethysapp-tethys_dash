import { useEffect, useState } from "react";
import appAPI from "services/api/app";

// Normalize a plugin's declared args (dict of name->config, or a list of names)
// down to a plain list of argument names for template building.
function argNames(args) {
  if (Array.isArray(args)) return args.map(String);
  if (args && typeof args === "object") return Object.keys(args);
  return [];
}

// Fetch the installed visualization catalog once and flatten the grouped
// response into [{ source, label, args: [names] }] for the slash-command menu.
export function usePluginCatalog() {
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    let active = true;
    appAPI
      .listVisualizations()
      .then((res) => {
        // apiClient's response interceptor already unwraps `.data`, so `res`
        // is the payload ({ visualizations: [...] }), not an axios response.
        const groups = res?.visualizations || [];
        const flat = [];
        for (const group of groups) {
          for (const opt of group.options || []) {
            if (!opt?.source) continue;
            flat.push({
              source: opt.source,
              label: opt.label || opt.value || opt.source,
              args: argNames(opt.args),
            });
          }
        }
        if (active) setCatalog(flat);
      })
      .catch(() => {
        if (active) setCatalog([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return catalog;
}

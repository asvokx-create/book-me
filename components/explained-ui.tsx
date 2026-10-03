import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

type ExplainedUiProps = {
  id: string;
  explanation: string;
  children: ReactNode;
  align?: "start" | "center" | "end";
  interactive?: boolean;
};

export default function ExplainedUi({ id, explanation, children, align = "center", interactive = false }: ExplainedUiProps) {
  const position = align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";
  const describedChild = interactive && isValidElement(children)
    ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, { "aria-describedby": id })
    : children;

  return <span
    className={`group relative inline-flex max-w-full align-middle ${interactive ? "" : "cursor-help rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#c7bb41] focus-visible:ring-offset-2"}`}
    tabIndex={interactive ? undefined : 0}
    aria-describedby={interactive ? undefined : id}
  >
    {describedChild}
    <span id={id} role="tooltip" className={`pointer-events-none invisible absolute bottom-[calc(100%+0.65rem)] z-[80] w-max max-w-[min(20rem,calc(100vw-2rem))] rounded-xl bg-[#183126] px-3 py-2 text-left text-xs font-medium leading-5 text-white opacity-0 shadow-xl transition duration-150 group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${position}`}>
      {explanation}
    </span>
  </span>;
}

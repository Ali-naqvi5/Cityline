import { startTransition, type FormEvent } from "react";

/**
 * Submits a form to a `useActionState` action without React's automatic form
 * reset.
 *
 * React 19 clears every uncontrolled field once a `<form action>` finishes —
 * even when the action came back with errors. On step 3 that wiped the
 * customer's name, email and ticked terms whenever the server refused
 * something, so they had to type it all again to fix one field.
 *
 * Use it as `onSubmit` *and* keep `action={dispatch}` on the form: with
 * JavaScript this handler runs (and, by preventing the default, stops React's
 * own submission); without JavaScript the browser still posts the form the
 * normal way.
 */
export function submitWithoutReset(dispatch: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(data));
  };
}

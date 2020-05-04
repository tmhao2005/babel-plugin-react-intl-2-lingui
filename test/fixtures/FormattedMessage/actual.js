import { React } from 'react';
import { FormattedMessage } from 'react-intl';
import { Trans, Plural } from "@lingui/react";

export const MyComponent = () => {
  return (
    <>
      <FormattedMessage id="app.greeting" defaultMessage="Hello" />
      <Trans id="app.name" defaults="You" />
    </>
  )
}

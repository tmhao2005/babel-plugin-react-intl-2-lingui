import { React } from 'react';
import { FormattedMessage } from 'react-intl';
import { Plural } from "@lingui/macro";

export const MyComponent = () => {
  const tally = 5;
  return (
    <>
      <FormattedMessage id="app.greeting" defaultMessage="Hello" />
      <Plural 
        one="1 person"
        other="# people"
        value={tally}
      />
    </>
  )
}

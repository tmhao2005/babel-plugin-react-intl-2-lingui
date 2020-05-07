## Install

```
npm i -D babel-plugin-react-intl-2-lingui
```

Then put to your `.babelrc` as plugin as following example:

```
{
  "presets": [
    "@babel/preset-env",
    "@babel/preset-react"
  ],
  "plugins": [
    "babel-plugin-react-intl-2-lingui"
  ]
}
```


## Objective

Just to convert existing `react-intl` components likes of `FormattedMessage` to `Trans` of `@lingui` package

### Simple use case:

In

```
import { FormattedMessage } from "react-intl";

<FormattedMessage id="Hello world!" defaultMessage="Hello world!" />
```

Out

```
import { Trans } from "@lingui/react";

<Trans id="Hello world!" defaults="Hello world!" />
```

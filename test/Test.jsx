import React from "react";

import styles from "./HyphenatedBEM.module.scss";

const Test = () => (
  <div className={styles.container}>
    <div className={styles.clear}>Hello, world!</div>
  </div>
);

export default Test;

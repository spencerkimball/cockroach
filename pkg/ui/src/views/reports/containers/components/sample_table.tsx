// Copyright 2019 The Cockroach Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
// implied. See the License for the specific language governing
// permissions and limitations under the License.

import _ from "lodash";
import d3 from "d3";
import * as React from "react";

import * as protos from  "src/js/protos";
import Loading from "src/views/shared/components/loading";
import { SystemComponentI } from "./component_node_matrix";
import { formatDuration } from "./time_util";

import "./sample_table.styl";

interface SampleTableProps {
  node_id: number;
  ct: protos.cockroach.util.tracing.IComponentTraces;
}

enum ColType {
  OpName = 1,
  Duration,
  Pending,
  Stuck,
  Error,
  Attribute,
}

function findCompSpan(s: protos.cockroach.util.tracing.ComponentSamples.ISample) {
  for (var idx in s.spans) {
    if (s.spans[idx].tags["syscomponent"]) {
      return s.spans[idx];
    }
  }
  return s.spans[0];
}

class Column {
  name: string;
  typ: ColType;

  constructor(name: string, typ: ColType) {
    this.name = name;
    this.typ = typ;
  }

  format(s: protos.cockroach.util.tracing.ComponentSamples.ISample, sort?: boolean) {
    const compSp: protos.cockroach.util.tracing.IRecordedSpan = findCompSpan(s);

    switch (this.typ) {
    case ColType.OpName: return (s.prefix ? s.prefix + ": " : "") + compSp.operation;
    case ColType.Duration:
      if (sort) {
        const {seconds, nanos } = compSp.duration;
        return seconds.toString().padStart(19, '0') + "." + nanos.toString().padStart(9, 0);
      }
      return formatDuration(compSp.duration);
    case ColType.Pending: return s.pending ? "Yes" : "No";
    case ColType.Stuck: return s.stuck ? "Yes" : "No";
    case ColType.Error: return s.error ? s.error : "";
    case ColType.Attribute:
      if (this.name in compSp.tags) {
        if (sort) {
          const num: number = Number(compSp.tags[this.name]);
          return (isNaN(num)) ? compSp.tags[this.name] : num;
        }
        return compSp.tags[this.name];
      }
      return "";
    }
  }
}

enum Direction {
  Up = 1,
  Down,
}

export class SortCol {
  col: Column;
  dir: Direction;

  constructor(col: Column, dir: Direction) {
    this.col = col;
    this.dir = dir;
  }
}

export class SortProps {
  sorts: SortCol[];

  constructor(sc: SortCol) {
    this.sorts = [sc];
  }

  toggleSort(col: Column) {
    const el: SortCol = _.find(this.sorts, function(sc) { return sc.col.name == col.name; })
    if (!el) {
      this.sorts.push(new SortCol(col, Direction.Up));
    } else if (el.dir == Direction.Up) {
      el.dir = Direction.Down;
    } else {
      _.remove(this.sorts, function(sc) { return sc.col.name == col.name; })
    }
    return this;
  }

  findSort(name: string) {
    return _.find(this.sorts, function(sc) { return sc.col.name == name; })
  }
}

function SampleHeader(props) {
  const { cols, sortProps, onSortSamples } = props;

  function onClick(c, e) {
    if (!sortProps) {
      onSortSamples(new SortProps(new SortCol(c, Direction.Up)));
    } else {
      onSortSamples(sortProps.toggleSort(c));
    }
  }

  function showSortDir(c) {
    if (!sortProps) return "";
    const sc: SortCol = sortProps.findSort(c.name);
    if (!sc) return "";
    return sc.dir == Direction.Up ? " ↑" : " ↓";
  }

  return (
      <tr>
      {
        _.map(cols, (c) => (
            <th className="sample-header" onClick={(e) => onClick(c, e)}>{c.name}{showSortDir(c)}</th>
        ))
      }
      </tr>
  );
}

function SampleRow(props) {
  const { s, cols, expandedSample, onToggleSample, onToggleComponent, expandedComponents, setComponent } = props;
  const compSp: protos.cockroach.util.tracing.IRecordedSpan = findCompSpan(s);

  function onClick(c, e) {
    onToggleSample(compSp.trace_id, compSp.span_id);
    setComponent(compSp.span_id);
  }

  function renderExpandedSample() {
    return (
        <expandedSample.Render onToggleComponent={onToggleComponent} expandedComponents={expandedComponents} />
    );
  }

  return (
      <React.Fragment>
        <tr className="sample-row">
        {
          _.map(cols, (c) => (
              <td className="sample" title={c.format(s)} onClick={(e) => onClick(c, e)}>{c.format(s)}</td>
          ))
        }
        </tr>
      {expandedSample && compSp.span_id.equals(expandedSample.span_id) &&
         <tr>
           <td className="sample-expanded" colspan={cols.length}>
             <Loading
               loading={expandedSample.active}
               error={expandedSample.error}
               render={renderExpandedSample}
             />
           </td>
         </tr>
        }
      </React.Fragment>
  );
}

export class SampleTable extends React.Component<SampleTableProps> {
  constructor(props: SampleTableProps) {
    super(props);
    this.state = {expandedComponents: {}};
  }

  componentDidUpdate() {
    if (this.props.expandedSample && this.props.expandedSample.scrollIntoView) {
      this.props.expandedSample.scrollIntoView();
    }
  }

  extractColumns = (samples: protos.cockroach.util.tracing.ComponentSamples.ISample[]) => {
    var cols: Column[] = [
      new Column("Op", ColType.OpName),
      new Column("Duration", ColType.Duration),
      new Column("Pending", ColType.Pending),
      new Column("Stuck", ColType.Stuck),
      new Column("Error", ColType.Error),
    ];

    const attrKeys: {[k: string]: boolean} = {};
    _.map(samples, (s) => {
      _.map(findCompSpan(s).tags, (v, k) => {
        attrKeys[k] = true;
      });
    });
    _.map(attrKeys, (v, k) => {
      cols.push(new Column(k, ColType.Attribute));
    });
    return cols;
  }

  sortSamples = (samples: protos.cockroach.util.tracing.ComponentSamples.ISample[], sortProps: SortProps) => {
    if (!sortProps) {
      return samples;
    }
    samples.sort(function(a, b) {
      for (let sc of sortProps.sorts) {
        const formA: any = sc.col.format(a, true /* sort */);
        const formB: any = sc.col.format(b, true /* sort */);
        const comp: number = (isNaN(formA) || isNaN(formB)) ? formA.localeCompare(formB) : formA - formB;
        if (comp != 0) {
          return sc.dir == Direction.Up ? comp : -comp;
        }
      }
      return 0;
    });
    return samples;
  }

  onToggleComponent = (span_id: Long) => {
    var expandedComponents = this.state.expandedComponents;
    if (span_id in this.state.expandedComponents) {
      delete expandedComponents[span_id];
    } else {
      expandedComponents[span_id] = true;
    }
    this.setState({expandedComponents: expandedComponents});
  }

  setComponent = (span_id: Long) => {
    var expandedComponents = {};
    expandedComponents[span_id] = true;
    this.setState({expandedComponents: expandedComponents});
  }

  render() {
    const {name, node_id, samples, sortProps, expandedSample, onSortSamples, onToggleSample } = this.props;
    const cols: Column[] = this.extractColumns(samples);
    const sortedSamples: protos.cockroach.util.tracing.ComponentSamples.ISample[] =
      this.sortSamples(samples, sortProps);

    return (
        <table id="samples">
          <React.Fragment>
            <SampleHeader cols={cols} sortProps={sortProps} onSortSamples={onSortSamples} />
            {
              _.map(sortedSamples, (s) => (
                  <SampleRow
                    s={s}
                    cols={cols}
                    expandedSample={expandedSample}
                    onToggleSample={onToggleSample}
                    onToggleComponent={this.onToggleComponent}
                    expandedComponents={this.state.expandedComponents}
                    setComponent={this.setComponent}
                  />
              ))
            }
          </React.Fragment>
        </table>
    );
  }
}

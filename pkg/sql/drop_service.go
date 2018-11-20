// Copyright 2018 The Cockroach Authors.
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

package sql

import (
	"context"

	"github.com/cockroachdb/cockroach/pkg/sql/sem/tree"
)

type dropServiceNode struct {
	tree.DropService
}

// DropService drops a service.
func (p *planner) DropService(ctx context.Context, n *tree.DropService) (planNode, error) {
	if n.Path == "" {
		return nil, errEmptyServicePath
	}

	if err := p.RequireSuperUser(ctx, "DROP SERVICE"); err != nil {
		return nil, err
	}

	return &dropServiceNode{
		DropService: *n,
	}, nil
}

func (n *dropServiceNode) startExec(params runParams) error {
	// Log Drop Service event.
	return MakeEventLogger(params.extendedEvalCtx.ExecCfg).InsertEventRecord(
		params.ctx,
		params.p.txn,
		EventLogDropService,
		int32(1 /* TODO: n.dbDesc.ID */),
		int32(params.extendedEvalCtx.NodeID),
		struct {
			ServicePath string
			Statement   string
			User        string
		}{n.Path, n.String(), params.p.SessionData().User},
	)
}

func (*dropServiceNode) Next(runParams) (bool, error) { return false, nil }
func (*dropServiceNode) Close(context.Context)        {}
func (*dropServiceNode) Values() tree.Datums          { return tree.Datums{} }

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

	"github.com/cockroachdb/cockroach/pkg/sql/pgwire/pgerror"
	"github.com/cockroachdb/cockroach/pkg/sql/sem/tree"
)

var (
	errEmptyServicePath       = pgerror.NewError(pgerror.CodeSyntaxError, "empty service path")
	errEmptyServiceDefinition = pgerror.NewError(pgerror.CodeSyntaxError, "empty service definition")
)

type createServiceNode struct {
	tree.CreateService
}

func (p *planner) CreateService(ctx context.Context, n *tree.CreateService) (planNode, error) {
	if n.Path == "" {
		return nil, errEmptyServicePath
	}
	if n.Definition == "" {
		return nil, errEmptyServiceDefinition
	}

	if err := p.RequireSuperUser(ctx, "CREATE SERVICE"); err != nil {
		return nil, err
	}

	return &createServiceNode{
		CreateService: *n,
	}, nil
}

func (n *createServiceNode) startExec(params runParams) error {
	created := true
	if created {
		if err := MakeEventLogger(params.extendedEvalCtx.ExecCfg).InsertEventRecord(
			params.ctx,
			params.p.txn,
			EventLogCreateService,
			int32(1 /* TODO: desc.ID */),
			int32(params.extendedEvalCtx.NodeID),
			struct {
				Path      string
				Statement string
				User      string
			}{n.Path, n.String(), params.SessionData().User},
		); err != nil {
			return err
		}
	}
	return nil
}

func (*createServiceNode) Next(runParams) (bool, error) { return false, nil }
func (*createServiceNode) Close(context.Context)        {}
func (*createServiceNode) Values() tree.Datums          { return nil }

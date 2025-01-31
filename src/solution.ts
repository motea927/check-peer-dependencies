import * as semver from 'semver';
import { exec } from 'shelljs';
import { Dependency } from './packageUtils';

function semverReverseSort(a, b) {
  const lt = semver.lt(a, b);
  const gt = semver.gt(a, b);
  if (!lt && !gt) {
    return 0;
  } else if (lt) {
    return 1;
  }
  return -1;
}

export interface Resolution {
  problem: Dependency;
  resolution: string;
  resolutionType: 'upgrade' | 'install' | 'devInstall';
}

export function findPossibleResolutions(problems: Dependency[], allPeerDependencies: Dependency[], includePrerelease: boolean): Resolution[] {
  const uniq: Dependency[] = problems.reduce((acc, problem) => acc.some(dep => dep.name === problem.name) ? acc : acc.concat(problem), []);
  return uniq.map(problem => {
    const shouldUpgrade = !!problem.installedVersion;
    const resolutionType = shouldUpgrade ? 'upgrade' : problem.isPeerDevDependency ? 'devInstall' : 'install';
    const resolutionVersion = findPossibleResolution(problem.name, allPeerDependencies, includePrerelease);
    const resolution = resolutionVersion ? `${problem.name}@${resolutionVersion}` : null;

    return { problem, resolution, resolutionType } as Resolution;
  })
}

function findPossibleResolution(packageName, allPeerDeps, includePrerelease) {
  const requiredPeerVersions = allPeerDeps.filter(dep => dep.name === packageName);
  // todo: skip this step if only one required peer version and it's an exact version
  const command = `npm view ${packageName} versions`;
  let rawVersionsInfo;
  try {
    rawVersionsInfo = exec(command, { silent: true }).stdout;
    const availableVersions = JSON.parse(rawVersionsInfo.replace(/'/g, '"')).sort(semverReverseSort);
    return availableVersions.find(ver => requiredPeerVersions.every(peerVer => {
      return semver.satisfies(ver, peerVer.version, { includePrerelease });
    }));
  } catch (err) {
    console.error(`Error while running command: '${command}'`);
    console.error(err);
    console.error();
    console.error('npm output:');
    console.error(rawVersionsInfo);
  }
}
